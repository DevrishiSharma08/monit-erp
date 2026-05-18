using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Inventory;

public class StockLotRepository(DbConnectionFactory db) : IStockLotRepository
{
    // ── Core SELECT ──────────────────────────────────────────────────────────
    // Used for the list query. Detail query has its own extended inline SQL.

    private const string LotSelect = @"
        SELECT
            sl.Id,
            sl.LotNumber,
            sl.GRNId                                                           AS GrnId,
            g.GRNNumber                                                        AS GrnNumber,
            CONVERT(NVARCHAR(10), g.GRNDate, 23)                              AS GrnDate,
            sl.MaterialId,
            ISNULL(poi.Description, mat.Description)                          AS Paper,
            sl.GSM                                                             AS Gsm,
            ISNULL(ps.Label, CAST(sl.GSM AS NVARCHAR(20)))                    AS Size,
            sl.MillId,
            mil.Name                                                           AS MillName,
            sl.WarehouseId,
            wh.Name                                                            AS WarehouseName,
            wb.BinCode                                                         AS BinLocation,
            sl.OpeningQty,
            sl.CurrentQty,
            sl.ReservedQty                                                     AS AllocatedQty,
            sl.AvailableQty,
            sl.CostPerUnit,
            sl.TotalCost,
            sl.[Condition]                                                     AS Condition,
            sl.QualityGrade,
            sl.[Status],
            sl.FIFOSequence                                                    AS FifoSequence,
            -- PO chain
            g.POId,
            g.PONumber,
            g.SourceLoadPlanId                                                 AS LoadPlanId,
            tlp.PlanNumber                                                     AS LoadPlanNumber,
            g.LinkedSOId,
            so.SONumber                                                        AS LinkedSoNumber,
            ISNULL(mt.CustomerName, cust.Name)                                AS CustomerName,
            -- Audit
            sl.CreatedBy,
            sl.CreatedAt
        FROM  inventory.StockLots               sl
        JOIN  inventory.GRNs                    g    ON g.Id   = sl.GRNId     AND g.IsDeleted  = 0
        JOIN  masters.Materials                 mat  ON mat.Id = sl.MaterialId
        JOIN  masters.Mills                     mil  ON mil.Id = sl.MillId
        LEFT JOIN masters.PaperSizes            ps   ON ps.Id  = sl.SizeId
        LEFT JOIN masters.Warehouses            wh   ON wh.Id  = sl.WarehouseId
        LEFT JOIN masters.WarehouseBins         wb   ON wb.Id  = sl.BinLocationId
        LEFT JOIN procurement.MillTrackers      mt   ON mt.Id  = g.MillTrackerId
        LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id = mt.POItemId
        LEFT JOIN procurement.PurchaseOrders    po   ON po.Id  = g.POId       AND po.IsDeleted = 0
        LEFT JOIN procurement.TruckLoadPlans    tlp  ON tlp.Id = g.SourceLoadPlanId
        LEFT JOIN sales.SalesOrders             so   ON so.Id  = g.LinkedSOId
        LEFT JOIN masters.Customers             cust ON cust.Id = so.CustomerId";

    // ── GetAllAsync ──────────────────────────────────────────────────────────

    public async Task<PagedResult<StockLotRow>> GetAllAsync(StockLotFilterRequest f)
    {
        var where = BuildWhere(f, out var param);
        const string orderBy = "sl.FIFOSequence ASC, sl.CreatedAt ASC";

        // Count query joins the same tables as the data query (search clause references them)
        var countSql = $@"
            SELECT COUNT(*)
            FROM  inventory.StockLots               sl
            JOIN  inventory.GRNs                    g    ON g.Id   = sl.GRNId     AND g.IsDeleted  = 0
            JOIN  masters.Materials                 mat  ON mat.Id = sl.MaterialId
            JOIN  masters.Mills                     mil  ON mil.Id = sl.MillId
            LEFT JOIN masters.PaperSizes            ps   ON ps.Id  = sl.SizeId
            LEFT JOIN masters.Warehouses            wh   ON wh.Id  = sl.WarehouseId
            LEFT JOIN masters.WarehouseBins         wb   ON wb.Id  = sl.BinLocationId
            LEFT JOIN procurement.MillTrackers      mt   ON mt.Id  = g.MillTrackerId
            LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id = mt.POItemId
            WHERE {where}";

        var dataSql = $"{LotSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<StockLotRow>(dataSql, param)).ToList();
        return new PagedResult<StockLotRow> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    // ── GetByIdAsync ─────────────────────────────────────────────────────────

    public async Task<StockLotDetailRow?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT
                sl.Id,
                sl.LotNumber,
                sl.GRNId                                                           AS GrnId,
                g.GRNNumber                                                        AS GrnNumber,
                CONVERT(NVARCHAR(10), g.GRNDate, 23)                              AS GrnDate,
                sl.MaterialId,
                ISNULL(poi.Description, mat.Description)                          AS Paper,
                sl.GSM                                                             AS Gsm,
                ISNULL(ps.Label, CAST(sl.GSM AS NVARCHAR(20)))                    AS Size,
                sl.MillId,
                mil.Name                                                           AS MillName,
                sl.WarehouseId,
                wh.Name                                                            AS WarehouseName,
                wb.BinCode                                                         AS BinLocation,
                sl.OpeningQty,
                sl.CurrentQty,
                sl.ReservedQty                                                     AS AllocatedQty,
                sl.AvailableQty,
                sl.CostPerUnit,
                sl.TotalCost,
                sl.[Condition]                                                     AS Condition,
                sl.QualityGrade,
                sl.[Status],
                sl.FIFOSequence                                                    AS FifoSequence,
                -- Chain
                g.POId,
                g.PONumber,
                g.SourceLoadPlanId                                                 AS LoadPlanId,
                tlp.PlanNumber                                                     AS LoadPlanNumber,
                g.LinkedSOId,
                so.SONumber                                                        AS LinkedSoNumber,
                ISNULL(mt.CustomerName, cust.Name)                                AS CustomerName,
                -- GRN transport
                g.QCResult                                                         AS GrnQcResult,
                g.VehicleNumber                                                    AS GrnVehicleNumber,
                g.LRNumber                                                         AS GrnLrNumber,
                g.[Condition]                                                      AS GrnCondition,
                -- TLP
                tlp.TruckNumber                                                    AS TlpTruckNumber,
                tlp.TransporterName                                                AS TlpTransporter,
                CONVERT(NVARCHAR(10), tlp.PlanDate, 23)                           AS TlpDate,
                tlp.Origin                                                         AS TlpOrigin,
                tlp.[Status]                                                       AS TlpStatus,
                -- SO / Customer
                CONVERT(NVARCHAR(10), so.OrderDate, 23)                           AS SoDate,
                cust.Name                                                          AS SoCustomerName,
                -- PO
                CONVERT(NVARCHAR(10), po.OrderDate, 23)                           AS PoDate,
                ISNULL(poi.Rate, 0)                                                AS PoRate,
                -- Billing mode
                ISNULL(po.BillingMode, 'Normal')                                  AS BillingMode,
                ISNULL(mt.CustomerName, cust.Name)                                AS EffectiveClientName,
                -- Audit
                sl.CreatedBy,
                sl.CreatedAt
            FROM  inventory.StockLots               sl
            JOIN  inventory.GRNs                    g    ON g.Id   = sl.GRNId     AND g.IsDeleted  = 0
            JOIN  masters.Materials                 mat  ON mat.Id = sl.MaterialId
            JOIN  masters.Mills                     mil  ON mil.Id = sl.MillId
            LEFT JOIN masters.PaperSizes            ps   ON ps.Id  = sl.SizeId
            LEFT JOIN masters.Warehouses            wh   ON wh.Id  = sl.WarehouseId
            LEFT JOIN masters.WarehouseBins         wb   ON wb.Id  = sl.BinLocationId
            LEFT JOIN procurement.MillTrackers      mt   ON mt.Id  = g.MillTrackerId
            LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id = mt.POItemId
            LEFT JOIN procurement.PurchaseOrders    po   ON po.Id  = g.POId       AND po.IsDeleted = 0
            LEFT JOIN procurement.TruckLoadPlans    tlp  ON tlp.Id = g.SourceLoadPlanId
            LEFT JOIN sales.SalesOrders             so   ON so.Id  = g.LinkedSOId
            LEFT JOIN masters.Customers             cust ON cust.Id = so.CustomerId
            WHERE sl.Id = @Id AND sl.IsDeleted = 0";

        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<StockLotDetailRow>(sql, new { Id = id });
    }

    // ── UpdateAsync ──────────────────────────────────────────────────────────

    public async Task UpdateAsync(int id, UpdateStockLotDto dto, string updatedBy)
    {
        // Compute new status if qty is being adjusted
        const string sql = @"
            UPDATE inventory.StockLots
            SET
                CurrentQty    = ISNULL(@CurrentQty,    CurrentQty),
                TotalCost     = CASE WHEN @CurrentQty IS NOT NULL
                                     THEN ISNULL(CostPerUnit, 0) * @CurrentQty
                                     ELSE TotalCost END,
                [Status]      = CASE
                                    WHEN @CurrentQty IS NOT NULL AND @CurrentQty = 0
                                        THEN 'Exhausted'
                                    WHEN @CurrentQty IS NOT NULL AND @CurrentQty > 0 AND ReservedQty = 0
                                        THEN 'Available'
                                    ELSE [Status]
                                END,
                WarehouseId   = ISNULL(@WarehouseId,   WarehouseId),
                BinLocationId = ISNULL(@BinLocationId, BinLocationId),
                QualityGrade  = ISNULL(@QualityGrade,  QualityGrade),
                UpdatedAt     = GETUTCDATE(),
                UpdatedBy     = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            Id = id,
            dto.CurrentQty,
            dto.WarehouseId,
            dto.BinLocationId,
            dto.QualityGrade,
            UpdatedBy = updatedBy
        });
    }

    // ── SoftDeleteAsync ──────────────────────────────────────────────────────

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = @"
            UPDATE inventory.StockLots
            SET    IsDeleted = 1, DeletedAt = GETUTCDATE(), DeletedBy = @DeletedBy
            WHERE  Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    // ── WHERE builder ────────────────────────────────────────────────────────

    private static string BuildWhere(StockLotFilterRequest f, out DynamicParameters p)
    {
        p = new DynamicParameters();
        var clauses = new List<string> { "sl.IsDeleted = 0" };

        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            clauses.Add("sl.[Status] = @Status");
            p.Add("Status", f.Status);
        }
        if (!string.IsNullOrWhiteSpace(f.WarehouseId) && int.TryParse(f.WarehouseId, out var wid))
        {
            clauses.Add("sl.WarehouseId = @WarehouseId");
            p.Add("WarehouseId", wid);
        }
        if (!string.IsNullOrWhiteSpace(f.MaterialId) && int.TryParse(f.MaterialId, out var mid))
        {
            clauses.Add("sl.MaterialId = @MaterialId");
            p.Add("MaterialId", mid);
        }
        if (!string.IsNullOrWhiteSpace(f.MillId) && int.TryParse(f.MillId, out var mlid))
        {
            clauses.Add("sl.MillId = @MillId");
            p.Add("MillId", mlid);
        }
        if (f.NoBin)
        {
            clauses.Add("sl.BinLocationId IS NULL");
        }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            clauses.Add(@"(
                sl.LotNumber   LIKE @Search OR
                g.GRNNumber    LIKE @Search OR
                g.PONumber     LIKE @Search OR
                mil.Name       LIKE @Search OR
                ISNULL(poi.Description, mat.Description) LIKE @Search
            )");
            p.Add("Search", $"%{f.Search}%");
        }

        return string.Join(" AND ", clauses);
    }
}
