using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Procurement;

public class TruckLoadPlanRepository(DbConnectionFactory db) : ITruckLoadPlanRepository
{
    // ── SELECT fragments ─────────────────────────────────────────────────────

    private const string PlanSelect = @"
        SELECT
            p.Id,
            p.PlanNumber,
            CONVERT(NVARCHAR(10), p.PlanDate,            23) AS PlanDate,
            p.TruckNumber,
            p.TruckType,
            p.TransporterName,
            p.DriverName,
            p.DriverPhone,
            p.TruckCapacityKg,
            p.FreightAmount,
            p.Origin,
            p.DeliveryMode,
            p.MillInvoiceNo,
            p.DeliveryBillNo,
            CONVERT(NVARCHAR(10), p.PlannedLoadDate,     23) AS PlannedLoadDate,
            CONVERT(NVARCHAR(10), p.PlannedDeliveryDate, 23) AS PlannedDeliveryDate,
            CONVERT(NVARCHAR(10), p.ActualLoadDate,      23) AS ActualLoadDate,
            CONVERT(NVARCHAR(10), p.ActualDeliveryDate,  23) AS ActualDeliveryDate,
            p.[Status],
            p.Remarks,
            p.CreatedAt
        FROM procurement.TruckLoadPlans p";

    private const string ItemSelect = @"
        SELECT
            i.Id, i.PlanId, i.TrackerId,
            i.PoNumber, i.SoNumber,
            i.Paper, i.Gsm, i.Size,
            i.CustomerName, i.Mill,
            i.Quantity, i.WeightKg,
            i.LoadOrder,
            i.DeliveryLocation, i.DeliveryAddress,
            i.MillInvoiceNo, i.DeliveryBillNo
        FROM procurement.TruckLoadPlanItems i
        WHERE i.IsDeleted = 0";

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<PagedResult<TruckLoadPlanDto>> GetAllAsync(TruckLoadPlanFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "p.PlannedLoadDate") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM procurement.TruckLoadPlans p WHERE {where}";
        var dataSql  = $"{PlanSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn  = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var plans = (await conn.QueryAsync<TruckLoadPlanDto>(dataSql, param)).ToList();

        if (plans.Count > 0) await AttachItems(conn, plans);

        return new PagedResult<TruckLoadPlanDto> { Items = plans, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<TruckLoadPlanDto?> GetByIdAsync(int id)
    {
        using var conn = db.Create();
        var plan = await conn.QueryFirstOrDefaultAsync<TruckLoadPlanDto>(
            $"{PlanSelect} WHERE p.Id=@Id AND p.IsDeleted=0", new { Id = id });

        if (plan == null) return null;
        await AttachItems(conn, [plan]);
        return plan;
    }

    public async Task<int> CountAsync()
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM procurement.TruckLoadPlans WHERE IsDeleted=0");
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    public async Task<int> CreateAsync(CreateTruckLoadPlanDto dto, string planNumber, string createdBy)
    {
        const string insertPlan = @"
            INSERT INTO procurement.TruckLoadPlans
                (PlanNumber, PlanDate, TruckNumber, TruckType, TransporterName, DriverName, DriverPhone,
                 TruckCapacityKg, FreightAmount, Origin, DeliveryMode, MillInvoiceNo, DeliveryBillNo,
                 PlannedLoadDate, PlannedDeliveryDate, [Status], Remarks,
                 CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@PlanNumber, CAST(GETUTCDATE() AS DATE), @TruckNumber, @TruckType, @TransporterName, @DriverName, @DriverPhone,
                 @TruckCapacityKg, @FreightAmount, @Origin, @DeliveryMode, @MillInvoiceNo, @DeliveryBillNo,
                 @PlannedLoadDate, @PlannedDeliveryDate, 'Planned', @Remarks,
                 GETUTCDATE(), @CreatedBy)";

        const string insertItem = @"
            INSERT INTO procurement.TruckLoadPlanItems
                (PlanId, TrackerId, PoNumber, SoNumber, Paper, Gsm, Size,
                 CustomerName, Mill, Quantity, WeightKg, LoadOrder,
                 DeliveryLocation, DeliveryAddress, MillInvoiceNo, DeliveryBillNo, CreatedAt)
            VALUES
                (@PlanId, @TrackerId, @PoNumber, @SoNumber, @Paper, @Gsm, @Size,
                 @CustomerName, @Mill, @Quantity, @WeightKg, @LoadOrder,
                 @DeliveryLocation, @DeliveryAddress, @MillInvoiceNo, @DeliveryBillNo, GETUTCDATE())";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            var planId = await conn.ExecuteScalarAsync<int>(insertPlan, new
            {
                PlanNumber          = planNumber,
                dto.TruckNumber,
                dto.TruckType,
                dto.TransporterName,
                dto.DriverName,
                dto.DriverPhone,
                dto.TruckCapacityKg,
                dto.FreightAmount,
                dto.Origin,
                dto.DeliveryMode,
                dto.MillInvoiceNo,
                dto.DeliveryBillNo,
                PlannedLoadDate     = ParseDateOnly(dto.PlannedLoadDate),
                PlannedDeliveryDate = ParseDateOnly(dto.PlannedDeliveryDate),
                dto.Remarks,
                CreatedBy = createdBy,
            }, tx);

            foreach (var it in dto.Items)
            {
                await conn.ExecuteAsync(insertItem, new
                {
                    PlanId          = planId,
                    it.TrackerId,
                    it.PoNumber,
                    it.SoNumber,
                    it.Paper,
                    it.Gsm,
                    it.Size,
                    it.CustomerName,
                    it.Mill,
                    it.Quantity,
                    it.WeightKg,
                    it.LoadOrder,
                    it.DeliveryLocation,
                    it.DeliveryAddress,
                    it.MillInvoiceNo,
                    it.DeliveryBillNo,
                }, tx);
            }

            tx.Commit();
            return planId;
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateStatusAsync(int id, UpdateTruckLoadPlanStatusDto dto, string updatedBy)
    {
        var setParts = new List<string>
        {
            "[Status]=@Status",
            "UpdatedAt=GETUTCDATE()",
            "UpdatedBy=@UpdatedBy",
        };
        if (!string.IsNullOrEmpty(dto.ActualLoadDate))
            setParts.Add("ActualLoadDate=@ActualLoadDate");
        if (!string.IsNullOrEmpty(dto.ActualDeliveryDate))
            setParts.Add("ActualDeliveryDate=@ActualDeliveryDate");
        if (dto.Remarks != null)
            setParts.Add("Remarks=@Remarks");

        using var conn = db.Create();
        await conn.ExecuteAsync(
            $"UPDATE procurement.TruckLoadPlans SET {string.Join(", ", setParts)} WHERE Id=@Id AND IsDeleted=0",
            new
            {
                Id                = id,
                dto.Status,
                UpdatedBy         = updatedBy,
                ActualLoadDate    = ParseDateOnly(dto.ActualLoadDate),
                ActualDeliveryDate = ParseDateOnly(dto.ActualDeliveryDate),
                dto.Remarks,
            });
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE procurement.TruckLoadPlans SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE Id=@Id AND IsDeleted=0",
            new { Id = id, By = deletedBy });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task AttachItems(System.Data.IDbConnection conn, List<TruckLoadPlanDto> plans)
    {
        var ids   = plans.Select(p => p.Id).ToList();
        var items = (await conn.QueryAsync<TruckLoadPlanItemDto>(
            $"{ItemSelect} AND i.PlanId IN @Ids ORDER BY i.PlanId, i.LoadOrder DESC",
            new { Ids = ids })).ToList();

        var map = items.GroupBy(i => i.PlanId).ToDictionary(g => g.Key, g => g.ToList());
        foreach (var plan in plans)
            plan.Items = map.TryGetValue(plan.Id, out var list) ? list : [];
    }

    private static (string, DynamicParameters) BuildWhere(TruckLoadPlanFilterRequest f)
    {
        var parts = new List<string> { "p.IsDeleted = 0" };
        var p     = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            parts.Add("p.[Status]=@Status");
            p.Add("Status", f.Status);
        }
        if (!string.IsNullOrWhiteSpace(f.TruckNumber))
        {
            parts.Add("p.TruckNumber LIKE @TruckNumber");
            p.Add("TruckNumber", $"%{f.TruckNumber.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(p.PlanNumber LIKE @Search OR p.TruckNumber LIKE @Search OR p.TransporterName LIKE @Search OR p.Origin LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.FromDate))
        {
            parts.Add("p.PlannedLoadDate >= @FromDate");
            p.Add("FromDate", DateOnly.Parse(f.FromDate));
        }
        if (!string.IsNullOrWhiteSpace(f.ToDate))
        {
            parts.Add("p.PlannedLoadDate <= @ToDate");
            p.Add("ToDate", DateOnly.Parse(f.ToDate));
        }

        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "p.Id", "p.CreatedAt", "p.PlannedLoadDate", "p.PlanDate", "p.[Status]", "p.TruckNumber" };

    private static string SafeColumn(string? col, string def)
    {
        if (string.IsNullOrEmpty(col)) return def;
        var qualified = col.Contains('.') ? col : $"p.{col}";
        return AllowedSort.Contains(qualified) ? qualified : def;
    }

    private static DateOnly? ParseDateOnly(string? val)
        => string.IsNullOrWhiteSpace(val) ? null : DateOnly.Parse(val);
}
