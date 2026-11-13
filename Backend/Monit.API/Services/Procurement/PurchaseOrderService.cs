using System.IO.Compression;
using Microsoft.AspNetCore.Http;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Procurement;

public class PurchaseOrderService(
    IPurchaseOrderRepository   repo,
    IMillTrackerRepository     millTrackerRepo,
    IEmailService              emailSvc,
    IPurchaseOrderPdfService   pdfSvc,
    ICompanyConfigService      companyCfgSvc,
    IHttpContextAccessor       http,
    AppConfig                  cfg) : IPurchaseOrderService
{
    public Task<PagedResult<PurchaseOrderListDto>> GetAllAsync(PurchaseOrderFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<PurchaseOrderListDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Purchase order {id} not found.");

    public async Task<PurchaseOrderListDto> CreateAsync(CreatePurchaseOrderDto dto, string createdBy)
    {
        if (dto.MillId <= 0)           throw new ValidationException("Mill is required.");
        if (dto.Items.Count == 0)      throw new ValidationException("At least one item is required.");
        if (string.IsNullOrWhiteSpace(dto.OrderDate)) throw new ValidationException("Order date is required.");

        var po       = MapToListDto(dto);
        var id       = await repo.CreateAsync(po, dto.Items, createdBy);
        var fullPo   = await GetByIdAsync(id);
        // Mill Tracker rows are NOT created here — they're created on Approve so a pending
        // PO doesn't appear in MOT until an admin explicitly approves it.
        return fullPo;
    }

    public async Task<PurchaseOrderListDto> UpdateAsync(int id, UpdatePurchaseOrderDto dto, string updatedBy)
    {
        var oldPo = await GetByIdAsync(id);
        if (dto.MillId <= 0)           throw new ValidationException("Mill is required.");
        if (dto.Items.Count == 0)      throw new ValidationException("At least one item is required.");

        await GuardMaterialSpecChangeAsync(oldPo, dto.Items);

        var po = MapToListDto(dto);
        if (!string.IsNullOrEmpty(dto.Status)) po.Status = dto.Status;
        await repo.UpdateAsync(id, po, dto.Items, updatedBy);
        var updatedPo = await GetByIdAsync(id);
        // Only sync MOT if the PO has already been approved (trackers exist). Editing a
        // still-pending PO must not auto-create trackers.
        if (!string.Equals(oldPo.Status, "Approval Pending", StringComparison.OrdinalIgnoreCase))
            await millTrackerRepo.SyncForPoUpdateAsync(id, oldPo, updatedPo, updatedBy);
        return updatedPo;
    }

    public async Task ApproveAsync(int id, string updatedBy)
    {
        var po = await GetByIdAsync(id);
        await repo.UpdateStatusAsync(id, "Sent to Mill", updatedBy);
        // Create MOT rows once the PO is approved — pending POs stay invisible in MOT until now
        await millTrackerRepo.CreateForPoAsync(po, updatedBy);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<PurchaseOrderListDto> CancelAsync(int id, CancelPurchaseOrderDto dto, string cancelledBy)
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

        var po       = await GetByIdAsync(id);
        var pdfBytes = await BuildPdfAsync(po);
        var fileName = $"PO_{po.PONumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.pdf";

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
        var po = await GetByIdAsync(id);
        return await BuildPdfAsync(po);
    }

    public async Task<byte[]> GetImageAsync(int id)
    {
        var po = await GetByIdAsync(id);
        var c  = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.GenerateImage(
            po,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "");
    }

    public async Task<byte[]> GetBulkPdfAsync(int[] ids)
    {
        var pos = new List<PurchaseOrderListDto>();
        foreach (var id in ids)
        {
            try { pos.Add(await GetByIdAsync(id)); }
            catch { /* skip missing ids */ }
        }
        var c = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.GenerateBulk(
            pos,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "");
    }

    public async Task<byte[]> GetBulkPdfZipAsync(int[] ids)
    {
        // ZIP — one PDF per PO, file names match the single-PDF endpoint.
        var c              = await companyCfgSvc.GetAsync(http.GetCompanyId());
        var companyName    = c.CompanyName ?? cfg.CompanyName;
        var companyAddress = c.Address     ?? cfg.CompanyAddress;
        var companyGst     = c.GstNumber   ?? "";
        var today          = DateTime.Today.ToString("yyyyMMdd");

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var id in ids)
            {
                PurchaseOrderListDto po;
                try { po = await GetByIdAsync(id); }
                catch { continue; }
                var pdfBytes   = pdfSvc.Generate(po, companyName, companyAddress, companyGst);
                var safeNumber = po.PONumber.Replace("/", "-").Replace("\\", "-");
                var entry      = zip.CreateEntry($"PO_{safeNumber}_{today}.pdf", CompressionLevel.Fastest);
                using var es   = entry.Open();
                es.Write(pdfBytes, 0, pdfBytes.Length);
            }
        }
        return ms.ToArray();
    }

    private async Task<byte[]> BuildPdfAsync(PurchaseOrderListDto po)
    {
        var c = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.Generate(
            po,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "");
    }

    // Material/GSM/Size/Quantity may only be edited while the item's mill
    // tracker (if any) is still sitting at "Order Placed" — once the mill
    // has reported any Ready/Dispatched/etc. progress against the ORIGINAL
    // spec, changing what was ordered (including the quantity itself) would
    // silently disagree with what's already being produced. Matches items
    // by LineNumber since UpsertPurchaseOrderItemDto (the incoming shape)
    // carries no item Id — only the DB-side items do.
    private async Task GuardMaterialSpecChangeAsync(PurchaseOrderListDto oldPo, List<UpsertPurchaseOrderItemDto> newItems)
    {
        var oldByLine = oldPo.Items.ToDictionary(i => i.LineNumber);
        var changedItemIds = new List<int>();
        foreach (var newItem in newItems)
        {
            if (!oldByLine.TryGetValue(newItem.LineNumber, out var oldItem)) continue; // brand-new line — nothing to guard
            var changed = oldItem.MaterialId != newItem.MaterialId
                       || oldItem.GSM != newItem.GSM
                       || !string.Equals(oldItem.Size, newItem.Size, StringComparison.Ordinal)
                       || oldItem.Quantity != newItem.Quantity
                       || oldItem.WeightKg != newItem.WeightKg;
            if (changed) changedItemIds.Add(oldItem.Id);
        }
        if (changedItemIds.Count == 0) return;

        var blocking = await millTrackerRepo.GetBlockingStatusesForPoItemsAsync(changedItemIds);
        if (blocking.Count == 0) return;

        var lines = oldPo.Items
            .Where(i => blocking.ContainsKey(i.Id))
            .Select(i => $"Line {i.LineNumber} (status: {blocking[i.Id]})");
        throw new ValidationException(
            $"Cannot change Material/GSM/Size/Quantity — mill production has already started: {string.Join(", ", lines)}. " +
            "These fields are only editable while the item's status is \"Order Placed\".");
    }

    private static PurchaseOrderListDto MapToListDto(CreatePurchaseOrderDto dto) => new()
    {
        MillId                = dto.MillId,
        MillUnitId            = dto.MillUnitId,
        OrderDate             = dto.OrderDate,
        POType                = dto.POType,
        LinkedSOId            = dto.LinkedSOId,
        DeliveryMode          = dto.DeliveryMode,
        ShipmentMode          = dto.ShipmentMode ?? "Normal",
        BlindShipment         = dto.BlindShipment,
        ShowDeliveryParty     = dto.ShowDeliveryParty,
        ShowCustomerName      = dto.ShowCustomerName,
        InvoiceParty          = dto.InvoiceParty,
        InvoicePartyId        = dto.InvoicePartyId,
        DirectCustomerId      = dto.DirectCustomerId,
        DirectDeliveryAddress = dto.DirectDeliveryAddress,
        ExpectedDeliveryDate  = dto.ExpectedDeliveryDate,
        MillSONumber          = dto.MillSONumber,
        PaymentTerms          = dto.PaymentTerms,
        InsurancePolicyNo     = dto.InsurancePolicyNo,
        TotalQuantity         = dto.TotalQuantity,
        TotalValue            = dto.TotalValue,
        Status                = "Approval Pending",
        GSTPercentage         = dto.GSTPercentage,
        Remarks               = dto.Remarks,
        SpecialInstructions   = dto.SpecialInstructions,
        IsBackfilled          = dto.IsBackfilled,
        PONumber              = dto.PONumber,
    };
}
