using Dapper;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Inventory;

public class DispatchReceiptService(
    IDispatchReceiptRepository  repo,
    DbConnectionFactory         db) : IDispatchReceiptService
{
    public Task<PagedResult<DispatchReceiptDto>> GetAllAsync(DispatchReceiptFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<DispatchReceiptDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id)
           ?? throw new NotFoundException($"Dispatch receipt {id} not found.");

    public Task<List<PendingTlpForDispatchDto>> GetPendingTlpsAsync()
        => repo.GetPendingTlpsAsync();

    public async Task<DispatchReceiptDto> CreateAsync(CreateDispatchReceiptDto dto, string createdBy)
    {
        Validate(dto);
        var number = await GenerateDispatchNumberAsync(createdBy);
        var id     = await repo.CreateAsync(dto, number, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<DispatchReceiptDto> UpdateAsync(int id, UpdateDispatchReceiptDto dto, string updatedBy)
    {
        Validate(dto);
        await GetByIdAsync(id); // 404 if missing
        if (await repo.HasGrnAsync(id))
            throw new ValidationException(
                "This dispatch already has a GRN recorded against it, so it can't be edited — the GRN's own material/qty data and any stock already put away were snapshotted from it. Record the correction as a new GRN instead.");
        await repo.UpdateAsync(id, dto, updatedBy);
        if (!string.IsNullOrEmpty(dto.Status))
            await repo.UpdateStatusAsync(id, dto.Status, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        if (await repo.HasGrnAsync(id))
            throw new ValidationException(
                "This dispatch already has a GRN recorded against it, so it can't be deleted — deleting it now would desync the GRN and any stock already put away from it.");
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static void Validate(CreateDispatchReceiptDto dto)
    {
        var errors = new List<string>();
        if (dto.SourceLoadPlanId <= 0)
            errors.Add("Source load plan is required.");
        if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
            errors.Add("Invoice number is required.");
        if (string.IsNullOrWhiteSpace(dto.DispatchDate))
            errors.Add("Dispatch date is required.");
        if (dto.Items.Count == 0)
            errors.Add("At least one item is required.");
        foreach (var (it, i) in dto.Items.Select((x, i) => (x, i + 1)))
        {
            if (it.DispatchedQty <= 0)
                errors.Add($"Item {i}: dispatched qty must be greater than zero.");
        }
        if (errors.Count > 0) throw new ValidationException(errors);
    }

    private async Task<string> GenerateDispatchNumberAsync(string user)
    {
        var year = DateTime.UtcNow.Year;
        const string sql = @"
            DECLARE @Num INT; DECLARE @Prefix NVARCHAR(10) = 'DR'; DECLARE @Padding INT = 4;
            UPDATE system.NumberSequences WITH (UPDLOCK)
            SET    @Num = LastNumber + 1, @Prefix = Prefix, @Padding = Padding,
                   LastNumber = LastNumber + 1, UpdatedAt = GETUTCDATE(), UpdatedBy = @User
            WHERE  Module = 'DR' AND [Year] = @Year;
            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
                VALUES ('DR', @Year, 1, 'DR', 4, @User);
                SET @Num = 1;
            END;
            SELECT @Prefix + '-' + CAST(@Year AS NVARCHAR(4)) + '-' +
                   RIGHT(REPLICATE('0', @Padding) + CAST(@Num AS NVARCHAR(10)), @Padding);";

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<string>(sql, new { Year = year, User = user })
               ?? $"DR-{year}-0001";
    }
}
