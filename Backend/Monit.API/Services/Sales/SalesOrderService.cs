using System.IO.Compression;
using Microsoft.AspNetCore.Http;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
using Monit.API.Models.DTOs.Sales;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Sales;

public class SalesOrderService(
    ISalesOrderRepository  repo,
    IMillTrackerRepository millTrackerRepo,
    IEmailService          emailSvc,
    ISalesOrderPdfService  pdfSvc,
    ICompanyConfigService  companyCfgSvc,
    IHttpContextAccessor   http,
    AppConfig              cfg) : ISalesOrderService
{
    public Task<PagedResult<SalesOrderListDto>> GetAllAsync(SalesOrderFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<SalesOrderListDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id)
           ?? throw new KeyNotFoundException($"Sales Order #{id} not found.");

    public async Task<SalesOrderListDto> CreateAsync(CreateSalesOrderDto dto, string createdBy)
    {
        Validate(dto);
        var id = await repo.CreateAsync(dto, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<SalesOrderListDto> UpdateAsync(int id, UpdateSalesOrderDto dto, string updatedBy)
    {
        Validate(dto);
        var oldSo = await GetByIdAsync(id);
        await GuardMaterialSpecChangeAsync(oldSo, dto.Lines);
        await repo.UpdateAsync(id, dto, updatedBy);
        return await GetByIdAsync(id);
    }

    // Material/GSM/Size/Quantity may only be edited while the mill tracker
    // (if any) for the linked PO item is still at "Order Placed" — same
    // rule as PO items, applied from the SO side via
    // PurchaseOrderItems.LinkedSOLineId. Quantity is guarded alongside spec
    // fields because a mill that's already reported Partial Ready/Ready
    // against an ordered qty has effectively "locked in" that number too —
    // silently changing it afterward would disagree with what's already
    // been produced, same risk as changing material/GSM/size. Matches
    // lines by LineNumber since UpsertSalesOrderLineDto (incoming) carries
    // no line Id — only the DB-side lines do.
    private async Task GuardMaterialSpecChangeAsync(SalesOrderListDto oldSo, List<UpsertSalesOrderLineDto> newLines)
    {
        var oldByLine = oldSo.Lines.ToDictionary(l => l.LineNumber);
        var changedLineIds = new List<int>();
        foreach (var newLine in newLines)
        {
            if (!oldByLine.TryGetValue(newLine.LineNumber, out var oldLine)) continue; // brand-new line — nothing to guard
            var changed = oldLine.MaterialId != newLine.MaterialId
                       || oldLine.Gsm != newLine.Gsm
                       || !string.Equals(oldLine.Size, newLine.Size, StringComparison.Ordinal)
                       || oldLine.OrderedQty != newLine.OrderedQty;
            if (changed) changedLineIds.Add(oldLine.Id);
        }
        if (changedLineIds.Count == 0) return;

        var blocking = await millTrackerRepo.GetBlockingStatusesForSoLinesAsync(changedLineIds);
        if (blocking.Count == 0) return;

        var lines = oldSo.Lines
            .Where(l => blocking.ContainsKey(l.Id))
            .Select(l => $"Line {l.LineNumber} (status: {blocking[l.Id]})");
        throw new ValidationException(
            $"Cannot change Material/GSM/Size/Quantity — mill production has already started against this item: {string.Join(", ", lines)}. " +
            "These fields are only editable while the item's status is \"Order Placed\".");
    }

    private static void Validate(CreateSalesOrderDto dto)
    {
        var errors = new List<string>();
        if (dto.Lines.Count == 0)
            errors.Add("A sales order must have at least one line.");
        foreach (var l in dto.Lines)
        {
            if (l.OrderedQty <= 0)
                errors.Add($"Line {l.LineNumber}: ordered quantity must be greater than zero.");
            if (l.Rate < 0)
                errors.Add($"Line {l.LineNumber}: rate cannot be negative.");
        }
        if (errors.Count > 0) throw new ValidationException(errors);
    }

    public async Task ApproveAsync(int id, string updatedBy)
    {
        // Ensure the SO exists (throws if not)
        await GetByIdAsync(id);
        await repo.UpdateStatusAsync(id, "Pending Allocation", updatedBy);
    }

    public Task DeleteAsync(int id, string deletedBy)
        => repo.SoftDeleteAsync(id, deletedBy);

    public async Task<SalesOrderListDto> CancelAsync(int id, CancelSalesOrderDto dto, string cancelledBy)
    {
        await GetByIdAsync(id);   // ensures it exists
        var reason = dto.Reason?.Trim() ?? "";
        if (reason.Length == 0)
            throw new ValidationException("A cancellation reason is required.");
        await repo.CancelAsync(id, reason, cancelledBy);
        return await GetByIdAsync(id);
    }

    public async Task<SendMailResponseDto> SendEmailAsync(int id, SendMailRequestDto dto)
    {
        if (dto.To.All(string.IsNullOrWhiteSpace))
            throw new ArgumentException("At least one recipient is required.");

        var so       = await GetByIdAsync(id);
        var pdfBytes = await BuildPdfAsync(so);
        var fileName = $"SO_{so.SONumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.pdf";

        await emailSvc.SendAsync(dto, pdfBytes, fileName);
        await repo.MarkEmailSentAsync(id);

        return new SendMailResponseDto
        {
            Success     = true,
            EmailSentAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
        };
    }

    public async Task<byte[]> GetPdfAsync(int id)
    {
        var so = await GetByIdAsync(id);
        return await BuildPdfAsync(so);
    }

    public async Task<byte[]> GetImageAsync(int id)
    {
        var so = await GetByIdAsync(id);
        var c  = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.GenerateImage(
            so,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "");
    }

    public async Task<byte[]> GetBulkPdfAsync(int[] ids)
    {
        // Fetch each SO in order, drop any that 404 so a stale grid selection
        // doesn't break the export.
        var sos = new List<SalesOrderListDto>();
        foreach (var id in ids)
        {
            try { sos.Add(await GetByIdAsync(id)); }
            catch { /* skip missing ids */ }
        }
        var c = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.GenerateBulk(
            sos,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "");
    }

    public async Task<byte[]> GetBulkPdfZipAsync(int[] ids)
    {
        // Build a ZIP with one PDF per SO so the user gets separate files
        // organized in a single download. File names match the single-PDF
        // endpoint: SO_<SONumber>_<yyyyMMdd>.pdf.
        var c          = await companyCfgSvc.GetAsync(http.GetCompanyId());
        var companyName    = c.CompanyName ?? cfg.CompanyName;
        var companyAddress = c.Address     ?? cfg.CompanyAddress;
        var companyGst     = c.GstNumber   ?? "";
        var today      = DateTime.Today.ToString("yyyyMMdd");

        using var ms  = new MemoryStream();
        // leaveOpen=true so we can read the buffer back after dispose.
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var id in ids)
            {
                SalesOrderListDto so;
                try { so = await GetByIdAsync(id); }
                catch { continue; /* stale id — skip */ }
                var pdfBytes   = pdfSvc.Generate(so, companyName, companyAddress, companyGst);
                var safeNumber = so.SONumber.Replace("/", "-").Replace("\\", "-");
                var entry      = zip.CreateEntry($"SO_{safeNumber}_{today}.pdf", CompressionLevel.Fastest);
                using var es   = entry.Open();
                es.Write(pdfBytes, 0, pdfBytes.Length);
            }
        }
        return ms.ToArray();
    }

    private async Task<byte[]> BuildPdfAsync(SalesOrderListDto so)
    {
        var c = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.Generate(
            so,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "");
    }
}
