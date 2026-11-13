using Dapper;
using Microsoft.AspNetCore.Http;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Inventory;

public class DeliveryChallanService(
    IDeliveryChallanRepository repo,
    DbConnectionFactory        db,
    IDeliveryChallanPdfService pdfSvc,
    ICompanyConfigService      companyCfgSvc,
    IHttpContextAccessor       http,
    AppConfig                  cfg) : IDeliveryChallanService
{
    private static readonly string[] AllowedStatuses =
        ["Draft", "Dispatched", "Delivered", "Cancelled"];

    public Task<PagedResult<DeliveryChallanDto>> GetAllAsync(DeliveryChallanFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<DeliveryChallanDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id)
           ?? throw new NotFoundException($"Delivery challan {id} not found.");

    public Task<List<OpenSoForDcDto>> GetOpenSosAsync(int? customerId)
        => repo.GetOpenSosAsync(customerId);

    public Task<List<AvailableStockSourceDto>> GetAvailableSourcesForSoLineAsync(int soLineId)
        => repo.GetAvailableSourcesForSoLineAsync(soLineId);

    public async Task<DeliveryChallanDto> CreateAsync(CreateDeliveryChallanDto dto, string createdBy)
    {
        Validate(dto);
        var number = await GenerateChallanNumberAsync(createdBy);
        var id     = await repo.CreateAsync(dto, number, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<DeliveryChallanDto> UpdateStatusAsync(int id, UpdateDeliveryChallanStatusDto dto, string updatedBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Status))
            throw new ValidationException("Status is required.");
        if (!AllowedStatuses.Contains(dto.Status))
            throw new ValidationException($"Invalid status '{dto.Status}'. Valid values: {string.Join(", ", AllowedStatuses)}");

        await GetByIdAsync(id);
        await repo.UpdateStatusAsync(id, dto.Status, dto.Remarks, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<int?> AutoCreateDraftFromGrnAsync(int grnId, decimal directQty, string createdBy)
    {
        if (directQty <= 0) return null;
        var number = await GenerateChallanNumberAsync(createdBy);
        return await repo.AutoCreateDraftFromGrnAsync(grnId, directQty, number, createdBy);
    }

    public async Task<byte[]> GetPdfAsync(int id)
    {
        var dc = await GetByIdAsync(id);
        return await BuildPdfAsync(dc);
    }

    public async Task<byte[]> GetImageAsync(int id)
    {
        var dc = await GetByIdAsync(id);
        var c  = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.GenerateImage(
            dc,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "",
            c.PanNumber);
    }

    private async Task<byte[]> BuildPdfAsync(DeliveryChallanDto dc)
    {
        var c = await companyCfgSvc.GetAsync(http.GetCompanyId());
        return pdfSvc.Generate(
            dc,
            c.CompanyName ?? cfg.CompanyName,
            c.Address     ?? cfg.CompanyAddress,
            c.GstNumber   ?? "",
            c.PanNumber);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static void Validate(CreateDeliveryChallanDto dto)
    {
        var errors = new List<string>();
        if (dto.SalesOrderId <= 0)
            errors.Add("Sales order is required.");
        if (dto.CustomerId <= 0)
            errors.Add("Customer is required.");
        if (string.IsNullOrWhiteSpace(dto.ChallanDate))
            errors.Add("Challan date is required.");
        if (dto.Items.Count == 0)
            errors.Add("At least one item is required.");
        foreach (var (it, i) in dto.Items.Select((x, i) => (x, i + 1)))
        {
            if (it.SalesOrderLineId <= 0)
                errors.Add($"Item {i}: sales order line is required.");
            if (it.QuantityKg <= 0)
                errors.Add($"Item {i}: quantity must be greater than zero.");
            var sourceCount = (it.StockLotId.HasValue ? 1 : 0) + (it.GrnId.HasValue ? 1 : 0);
            if (sourceCount == 0)
                errors.Add($"Item {i}: must pick either a stock lot or a direct GRN.");
            if (sourceCount > 1)
                errors.Add($"Item {i}: cannot source from both a stock lot and a GRN — pick one.");
        }
        if (errors.Count > 0) throw new ValidationException(errors);
    }

    private async Task<string> GenerateChallanNumberAsync(string user)
    {
        var year = DateTime.UtcNow.Year;
        const string sql = @"
            DECLARE @Num INT; DECLARE @Prefix NVARCHAR(10) = 'DC'; DECLARE @Padding INT = 4;
            UPDATE system.NumberSequences WITH (UPDLOCK)
            SET    @Num = LastNumber + 1, @Prefix = Prefix, @Padding = Padding,
                   LastNumber = LastNumber + 1, UpdatedAt = GETUTCDATE(), UpdatedBy = @User
            WHERE  Module = 'DC' AND [Year] = @Year;
            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
                VALUES ('DC', @Year, 1, 'DC', 4, @User);
                SET @Num = 1;
            END;
            SELECT @Prefix + '-' + CAST(@Year AS NVARCHAR(4)) + '-' +
                   RIGHT(REPLICATE('0', @Padding) + CAST(@Num AS NVARCHAR(10)), @Padding);";

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<string>(sql, new { Year = year, User = user })
               ?? $"DC-{year}-0001";
    }
}
