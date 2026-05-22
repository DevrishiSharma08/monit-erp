using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Inventory;

public class GrnRepository(DbConnectionFactory db) : IGrnRepository
{
    // ── Core SELECT ──────────────────────────────────────────────────────────
    // Used by GetAllAsync (list). GetByIdAsync has its own extended inline SQL.

    private const string GrnSelect = @"
        SELECT
            g.Id,
            g.GRNNumber                                                         AS GrnNumber,
            CONVERT(NVARCHAR(10), g.GRNDate, 23)                               AS GrnDate,
            g.[Status],
            g.POId,
            g.PONumber,
            g.MillTrackerId,
            g.SourceLoadPlanId,
            tlp.PlanNumber                                                      AS LoadPlanNumber,
            g.MillId,
            mil.Name                                                            AS MillName,
            g.MaterialId,
            ISNULL(poi.Description, mat.Description)                           AS Paper,
            g.GSM                                                               AS Gsm,
            g.[Size],
            g.OrderedQty,
            g.PreviouslyReceivedQty,
            g.ReceivedQty,
            g.ShortQty,
            g.DamagedQty,
            g.BalanceQty,
            g.ReceivedWeightMT                                                  AS ReceivedWeightMt,
            -- Delivery routing
            g.GRNDeliveryMode,
            g.StockQty,
            g.DirectQty,
            g.DirectClientId,
            g.DirectClientName,
            -- PO billing mode
            ISNULL(po.BillingMode, 'Normal')                                   AS BillingMode,
            ISNULL(po.BlindShipment, 0)                                        AS BlindShipment,
            -- Warehouse
            g.WarehouseId,
            wh.Name                                                             AS WarehouseName,
            wb.BinCode                                                          AS BinLocation,
            g.LotNumber,
            g.VehicleNumber,
            g.LRNumber                                                          AS LrNumber,
            CONVERT(NVARCHAR(10), g.DispatchDate, 23)                          AS DispatchDate,
            g.[Condition],
            g.QCResult                                                          AS QcResult,
            g.QualityGrade,
            -- Linked SO / effective client
            g.LinkedSOId                                                        AS LinkedSoId,
            so.SONumber                                                         AS LinkedSoNumber,
            ISNULL(mt.CustomerName, cust.Name)                                 AS CustomerName,
            ISNULL(mt.CustomerName, cust.Name)                                 AS EffectiveClientName,
            -- Billing & packing
            g.ItemInvoiceNo,
            g.BillingRate,
            g.PackingType,
            g.SheetsPerPacket,
            g.PacketsPerBundle,
            g.NoOfPackets,
            g.NoOfBundles,
            -- Audit
            g.CreatedBy,
            g.CreatedAt
        FROM  inventory.GRNs                    g
        JOIN  masters.Mills                     mil  ON mil.Id  = g.MillId
        JOIN  masters.Materials                 mat  ON mat.Id  = g.MaterialId
        LEFT JOIN procurement.MillTrackers      mt   ON mt.Id   = g.MillTrackerId
        LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id  = mt.POItemId
        LEFT JOIN procurement.PurchaseOrders    po   ON po.Id   = g.POId  AND po.IsDeleted = 0
        LEFT JOIN procurement.TruckLoadPlans    tlp  ON tlp.Id  = g.SourceLoadPlanId
        LEFT JOIN masters.Warehouses            wh   ON wh.Id   = g.WarehouseId
        LEFT JOIN masters.WarehouseBins         wb   ON wb.Id   = g.BinLocationId
        LEFT JOIN sales.SalesOrders             so   ON so.Id   = g.LinkedSOId
        LEFT JOIN masters.Customers             cust ON cust.Id = so.CustomerId";

    // ── GetAllAsync ──────────────────────────────────────────────────────────

    public async Task<PagedResult<GrnListDto>> GetAllAsync(GrnFilterRequest f)
    {
        var where = BuildWhere(f, out var param);
        var orderBy = "g.CreatedAt DESC";

        // Count query needs the same JOINs as the data query (search references mil.Name, mat.Description)
        var countSql = $@"
            SELECT COUNT(*)
            FROM  inventory.GRNs                    g
            JOIN  masters.Mills                     mil  ON mil.Id  = g.MillId
            JOIN  masters.Materials                 mat  ON mat.Id  = g.MaterialId
            LEFT JOIN procurement.MillTrackers      mt   ON mt.Id   = g.MillTrackerId
            LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id  = mt.POItemId
            WHERE {where}";
        var dataSql  = $"{GrnSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<GrnListDto>(dataSql, param)).ToList();

        return new PagedResult<GrnListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    // ── GetByIdAsync ─────────────────────────────────────────────────────────

    public async Task<GrnDetailDto?> GetByIdAsync(int id)
    {
        const string detailSql = @"
            SELECT
                g.Id,
                g.GRNNumber                                                         AS GrnNumber,
                CONVERT(NVARCHAR(10), g.GRNDate, 23)                               AS GrnDate,
                g.[Status],
                g.POId,
                g.PONumber,
                g.MillTrackerId,
                g.SourceLoadPlanId,
                tlp.PlanNumber                                                      AS LoadPlanNumber,
                g.MillId,
                mil.Name                                                            AS MillName,
                g.MaterialId,
                ISNULL(poi.Description, mat.Description)                           AS Paper,
                g.GSM                                                               AS Gsm,
                g.[Size],
                g.OrderedQty,
                g.PreviouslyReceivedQty,
                g.ReceivedQty,
                g.ShortQty,
                g.DamagedQty,
                g.BalanceQty,
                g.ReceivedWeightMT                                                  AS ReceivedWeightMt,
                g.ExpectedWeightMT                                                  AS ExpectedWeightMt,
                -- Delivery routing
                g.GRNDeliveryMode,
                g.StockQty,
                g.DirectQty,
                g.DirectClientId,
                g.DirectClientName,
                -- PO billing mode
                ISNULL(po.BillingMode, 'Normal')                                   AS BillingMode,
                ISNULL(po.BlindShipment, 0)                                        AS BlindShipment,
                po.OverrideClientName,
                po.DirectDeliveryAddress,
                -- Warehouse
                g.WarehouseId,
                wh.Name                                                             AS WarehouseName,
                wb.BinCode                                                          AS BinLocation,
                g.SuggestedBin,
                g.LotNumber,
                g.VehicleNumber,
                g.LRNumber                                                          AS LrNumber,
                g.DriverName,
                g.[Condition],
                g.QCResult                                                          AS QcResult,
                g.QualityGrade,
                g.PurchaseInvoiceNumber,
                g.MillChallanNumber,
                g.FreightAmount,
                g.UnloadingCharges,
                g.InvoiceEligible,
                g.ReceivedBy,
                g.Remarks,
                g.QCApprovedBy                                                      AS QcApprovedBy,
                CONVERT(NVARCHAR(10), g.QCDate, 23)                                AS QcDate,
                -- Linked SO / effective client
                g.LinkedSOId                                                        AS LinkedSoId,
                so.SONumber                                                         AS LinkedSoNumber,
                ISNULL(mt.CustomerName, cust.Name)                                 AS CustomerName,
                ISNULL(mt.CustomerName, cust.Name)                                 AS EffectiveClientName,
                -- SO chain fields
                CONVERT(NVARCHAR(10), so.OrderDate, 23)                            AS SoDate,
                cust.Name                                                           AS SoCustomerName,
                sm.Name                                                             AS SoSalesmanName,
                sol.Quantity                                                        AS SoOrderedQty,
                sol.Rate                                                            AS SoRate,
                -- PO chain fields
                CONVERT(NVARCHAR(10), po.OrderDate, 23)                            AS PoDate,
                mil.Name                                                            AS PoSupplierName,
                CASE WHEN ISNULL(poi.Discount, 0) > 0
                     THEN ISNULL(poi.Rate, 0) / (1.0 - ISNULL(poi.Discount, 0) / 100.0)
                     ELSE ISNULL(poi.Rate, 0)
                END                                                                AS PoRate,
                -- TLP chain fields
                CONVERT(NVARCHAR(10), tlp.PlanDate, 23)                           AS TlpDate,
                tlp.TruckNumber                                                     AS TlpTruckNumber,
                tlp.TransporterName                                                 AS TlpTransporter,
                g.CreatedBy,
                g.CreatedAt
            FROM  inventory.GRNs                    g
            JOIN  masters.Mills                     mil  ON mil.Id  = g.MillId
            JOIN  masters.Materials                 mat  ON mat.Id  = g.MaterialId
            LEFT JOIN procurement.MillTrackers      mt   ON mt.Id   = g.MillTrackerId
            LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id  = mt.POItemId
            LEFT JOIN procurement.PurchaseOrders    po   ON po.Id   = g.POId AND po.IsDeleted = 0
            LEFT JOIN procurement.TruckLoadPlans    tlp  ON tlp.Id  = g.SourceLoadPlanId
            LEFT JOIN masters.Warehouses            wh   ON wh.Id   = g.WarehouseId
            LEFT JOIN masters.WarehouseBins         wb   ON wb.Id   = g.BinLocationId
            LEFT JOIN sales.SalesOrders             so   ON so.Id   = g.LinkedSOId
            LEFT JOIN masters.Customers             cust ON cust.Id = so.CustomerId
            LEFT JOIN masters.Salesmen              sm   ON sm.Id   = so.SalesmanId
            LEFT JOIN sales.SalesOrderLines         sol  ON sol.SOId = so.Id AND sol.MaterialId = g.MaterialId
            WHERE g.Id = @Id AND g.IsDeleted = 0";

        const string logSql = @"
            SELECT FromStatus, ToStatus, Remarks, ChangedBy, ChangedAt
            FROM inventory.GRNStatusLog
            WHERE GRNId = @Id
            ORDER BY ChangedAt";

        using var conn = db.Create();
        var grn = await conn.QueryFirstOrDefaultAsync<GrnDetailDto>(detailSql, new { Id = id });
        if (grn is null) return null;

        grn.StatusLog = (await conn.QueryAsync<GrnStatusLogDto>(logSql, new { Id = id })).ToList();
        return grn;
    }

    // ── GetTrackerContextAsync ───────────────────────────────────────────────

    public async Task<GrnTrackerContext?> GetTrackerContextAsync(int trackerId)
    {
        const string sql = @"
            SELECT
                mt.Id                                                           AS TrackerId,
                mt.POId,
                po.PONumber,
                mt.MillId,
                mil.Name                                                        AS MillName,
                mil.Code                                                        AS MillCode,
                mt.MaterialId,
                ISNULL(poi.Description, mat.Description)                       AS Paper,
                ISNULL(ssg.Name, 'PAPR')                                       AS CategoryCode,
                ISNULL(poi.GSM, mat.GSM)                                       AS Gsm,
                poi.[Size]                                                      AS Size,
                mt.OrderedQty,
                mt.LinkedSOId,
                ISNULL(poi.Rate, 0)                                            AS Rate,
                -- PO billing mode
                ISNULL(po.BillingMode, 'Normal')                               AS BillingMode,
                ISNULL(po.BlindShipment, 0)                                    AS BlindShipment,
                po.OverrideClientName,
                po.DirectCustomerId,
                po.DirectDeliveryAddress,
                -- MillTracker linked customer (denormalized from SO)
                mt.CustomerId,
                mt.CustomerName
            FROM procurement.MillTrackers           mt
            JOIN procurement.PurchaseOrders         po  ON po.Id  = mt.POId  AND po.IsDeleted = 0
            JOIN masters.Mills                      mil ON mil.Id = mt.MillId
            JOIN masters.Materials                  mat ON mat.Id = mt.MaterialId
            LEFT JOIN masters.StockSubGroups        ssg ON ssg.Id = mat.QualityId
            LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id = mt.POItemId
            WHERE mt.Id = @TrackerId AND mt.IsDeleted = 0";

        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<GrnTrackerContext>(sql, new { TrackerId = trackerId });
    }

    // ── GetCustomerNameAsync ─────────────────────────────────────────────────

    public async Task<string?> GetCustomerNameAsync(int customerId)
    {
        const string sql = "SELECT Name FROM masters.Customers WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<string?>(sql, new { Id = customerId });
    }

    // ── GetPreviouslyReceivedQtyAsync ────────────────────────────────────────

    public async Task<decimal> GetPreviouslyReceivedQtyAsync(int trackerId)
    {
        const string sql = @"
            SELECT ISNULL(SUM(ReceivedQty), 0)
            FROM inventory.GRNs
            WHERE MillTrackerId = @TrackerId AND IsDeleted = 0";

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<decimal>(sql, new { TrackerId = trackerId });
    }

    // ── GetNextFifoSequenceAsync ─────────────────────────────────────────────

    public async Task<int> GetNextFifoSequenceAsync(int materialId)
    {
        const string sql = @"
            SELECT ISNULL(MAX(FIFOSequence), 0) + 1
            FROM inventory.StockLots
            WHERE MaterialId = @MaterialId AND IsDeleted = 0";

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { MaterialId = materialId });
    }

    // ── CreateAsync ──────────────────────────────────────────────────────────

    public async Task<GrnListDto> CreateAsync(
        CreateGrnDto dto,
        GrnTrackerContext ctx,
        GrnComputedValues cv,
        string createdBy)
    {
        var balance = ctx.OrderedQty - cv.PrevQty - dto.ReceivedQty;

        const string sql = @"
            INSERT INTO inventory.GRNs (
                GRNNumber, GRNDate, [Status],
                POId, PONumber,
                MillTrackerId, SourceLoadPlanId,
                MillId, MaterialId, GSM, [Size],
                OrderedQty, PreviouslyReceivedQty, ReceivedQty,
                ShortQty, DamagedQty, BalanceQty,
                ReceivedWeightMT, ExpectedWeightMT,
                WarehouseId, BinLocationId, SuggestedBin,
                [Condition], QCResult, QualityGrade,
                LotNumber, LRNumber, VehicleNumber, DriverName,
                FreightAmount, UnloadingCharges, InvoiceEligible,
                PurchaseInvoiceNumber, MillChallanNumber,
                DispatchDate, ItemInvoiceNo, BillingRate,
                PackingType, SheetsPerPacket, PacketsPerBundle, NoOfPackets, NoOfBundles,
                LinkedSOId, ReceivedBy, Remarks,
                GRNDeliveryMode, StockQty, DirectQty, DirectClientId, DirectClientName,
                CreatedAt, CreatedBy
            )
            OUTPUT INSERTED.Id
            VALUES (
                @GrnNumber, @GrnDate, @Status,
                @PoId, @PoNumber,
                @MillTrackerId, @SourceLoadPlanId,
                @MillId, @MaterialId, @Gsm, @Size,
                @OrderedQty, @PrevQty, @ReceivedQty,
                @ShortQty, @DamagedQty, @Balance,
                @ReceivedWeightMt, NULL,
                @WarehouseId, @BinLocationId, NULL,
                @Condition, @QcResult, @QualityGrade,
                @LotNumber, @LrNumber, @VehicleNumber, @DriverName,
                @FreightAmount, @UnloadingCharges, @InvoiceEligible,
                @PurchaseInvoiceNumber, @MillChallanNumber,
                TRY_CAST(@DispatchDate AS DATE), @ItemInvoiceNo, @BillingRate,
                @PackingType, @SheetsPerPacket, @PacketsPerBundle, @NoOfPackets, @NoOfBundles,
                @LinkedSoId, @ReceivedBy, @Remarks,
                @DeliveryMode, @StockQty, @DirectQty, @DirectClientId, @DirectClientName,
                GETUTCDATE(), @CreatedBy
            )";

        var p = new DynamicParameters();
        p.Add("GrnNumber",             cv.GrnNumber);
        p.Add("GrnDate",               dto.GrnDate);
        p.Add("Status",                cv.Status);
        p.Add("PoId",                  ctx.PoId);
        p.Add("PoNumber",              ctx.PoNumber);
        p.Add("MillTrackerId",         ctx.TrackerId);
        p.Add("SourceLoadPlanId",      dto.SourceLoadPlanId);
        p.Add("MillId",                ctx.MillId);
        p.Add("MaterialId",            ctx.MaterialId);
        p.Add("Gsm",                   ctx.Gsm);
        p.Add("Size",                  ctx.Size);
        p.Add("OrderedQty",            ctx.OrderedQty);
        p.Add("PrevQty",               cv.PrevQty);
        p.Add("ReceivedQty",           dto.ReceivedQty);
        p.Add("ShortQty",              dto.ShortQty);
        p.Add("DamagedQty",            dto.DamagedQty);
        p.Add("Balance",               balance < 0 ? 0 : balance);
        p.Add("ReceivedWeightMt",      dto.ReceivedWeightMt);
        p.Add("WarehouseId",           dto.WarehouseId);
        p.Add("BinLocationId",         dto.BinLocationId);
        p.Add("Condition",             dto.Condition);
        p.Add("QcResult",              dto.QcResult);
        p.Add("QualityGrade",          dto.QualityGrade);
        p.Add("LotNumber",             cv.LotNumber);
        p.Add("LrNumber",              dto.LrNumber);
        p.Add("VehicleNumber",         dto.VehicleNumber);
        p.Add("DriverName",            dto.DriverName);
        p.Add("FreightAmount",         dto.FreightAmount);
        p.Add("UnloadingCharges",      dto.UnloadingCharges);
        p.Add("InvoiceEligible",       dto.InvoiceEligible);
        p.Add("PurchaseInvoiceNumber", dto.PurchaseInvoiceNumber);
        p.Add("MillChallanNumber",     dto.MillChallanNumber);
        p.Add("DispatchDate",          dto.DispatchDate);
        p.Add("ItemInvoiceNo",         dto.ItemInvoiceNo);
        p.Add("BillingRate",           dto.BillingRate);
        p.Add("PackingType",           dto.PackingType);
        p.Add("SheetsPerPacket",       dto.SheetsPerPacket);
        p.Add("PacketsPerBundle",      dto.PacketsPerBundle);
        p.Add("NoOfPackets",           dto.NoOfPackets);
        p.Add("NoOfBundles",           dto.NoOfBundles);
        p.Add("LinkedSoId",            ctx.LinkedSoId);
        p.Add("ReceivedBy",            dto.ReceivedBy);
        p.Add("Remarks",               dto.Remarks);
        p.Add("DeliveryMode",          cv.DeliveryMode);
        p.Add("StockQty",              cv.StockQty);
        p.Add("DirectQty",             cv.DirectQty);
        p.Add("DirectClientId",        cv.DirectClientId);
        p.Add("DirectClientName",      cv.DirectClientName);
        p.Add("CreatedBy",             createdBy);

        using var conn = db.Create();
        var newId = await conn.ExecuteScalarAsync<int>(sql, p);
        return (await GetByIdAsync(newId))!;
    }

    // ── UpdateAsync ──────────────────────────────────────────────────────────

    public async Task UpdateAsync(int id, UpdateGrnDto dto, string updatedBy)
    {
        const string sql = @"
            UPDATE inventory.GRNs
            SET    WarehouseId   = @WarehouseId,
                   BinLocationId = @BinLocationId,
                   Remarks       = @Remarks,
                   ReceivedBy    = @ReceivedBy,
                   UpdatedAt     = GETUTCDATE(),
                   UpdatedBy     = @UpdatedBy
            WHERE  Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            id, dto.WarehouseId, dto.BinLocationId,
            dto.Remarks, dto.ReceivedBy, UpdatedBy = updatedBy
        });
    }

    // ── UpdateStatusAsync ────────────────────────────────────────────────────

    public async Task UpdateStatusAsync(int id, UpdateGrnStatusDto dto, string updatedBy)
    {
        const string sql = @"
            UPDATE inventory.GRNs
            SET    [Status]      = @Status,
                   QCApprovedBy  = ISNULL(@QcApprovedBy, QCApprovedBy),
                   QCDate        = ISNULL(TRY_CAST(@QcDate AS DATE), QCDate),
                   UpdatedAt     = GETUTCDATE(),
                   UpdatedBy     = @UpdatedBy
            WHERE  Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            Id = id, dto.Status, dto.QcApprovedBy, dto.QcDate, UpdatedBy = updatedBy
        });
    }

    // ── LogStatusChangeAsync ─────────────────────────────────────────────────

    public async Task LogStatusChangeAsync(
        int grnId, string? fromStatus, string toStatus, string? remarks, string changedBy)
    {
        const string sql = @"
            INSERT INTO inventory.GRNStatusLog (GRNId, FromStatus, ToStatus, Remarks, ChangedBy, ChangedAt)
            VALUES (@GrnId, @FromStatus, @ToStatus, @Remarks, @ChangedBy, GETUTCDATE())";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { GrnId = grnId, fromStatus, toStatus, remarks, changedBy });
    }

    // ── CreateStockLotAsync ──────────────────────────────────────────────────
    // Only called when StockQty > 0. Uses warehouse/bin from the GRN row.

    public async Task CreateStockLotAsync(
        int grnId, GrnTrackerContext ctx, string lotNumber,
        decimal qty, decimal? costPerUnit, int fifoSeq, string createdBy)
    {
        const string sql = @"
            INSERT INTO inventory.StockLots (
                LotNumber, GRNId,
                MaterialId, MillId, GSM, SizeId,
                WarehouseId, BinLocationId,
                GRNDate, OpeningQty, CurrentQty, ReservedQty,
                CostPerUnit, TotalCost,
                [Status], FIFOSequence,
                PackingType, SheetsPerPacket, PacketsPerBundle, NoOfPackets, NoOfBundles,
                CreatedAt, CreatedBy
            )
            SELECT
                @LotNumber, @GrnId,
                @MaterialId, @MillId, @Gsm,
                (SELECT TOP 1 ps.Id FROM masters.PaperSizes ps WHERE ps.Label = @SizeLabel),
                g.WarehouseId, g.BinLocationId,
                g.GRNDate, @Qty, @Qty, 0,
                @CostPerUnit, @Qty * ISNULL(@CostPerUnit, 0),
                'Available', @FifoSeq,
                g.PackingType, g.SheetsPerPacket, g.PacketsPerBundle, g.NoOfPackets, g.NoOfBundles,
                GETUTCDATE(), @CreatedBy
            FROM inventory.GRNs g
            WHERE g.Id = @GrnId";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            LotNumber   = lotNumber,
            GrnId       = grnId,
            ctx.MaterialId,
            ctx.MillId,
            ctx.Gsm,
            SizeLabel   = ctx.Size,
            Qty         = qty,
            CostPerUnit = costPerUnit,
            FifoSeq     = fifoSeq,
            CreatedBy   = createdBy
        });
    }

    // ── SoftDeleteAsync ──────────────────────────────────────────────────────

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = @"
            UPDATE inventory.GRNs
            SET    IsDeleted = 1, DeletedAt = GETUTCDATE(), DeletedBy = @DeletedBy
            WHERE  Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    // ── WHERE builder ────────────────────────────────────────────────────────

    private static string BuildWhere(GrnFilterRequest f, out DynamicParameters p)
    {
        p = new DynamicParameters();
        var clauses = new List<string> { "g.IsDeleted = 0" };

        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            clauses.Add("g.[Status] = @Status");
            p.Add("Status", f.Status);
        }
        if (!string.IsNullOrWhiteSpace(f.MillId) && int.TryParse(f.MillId, out var mid))
        {
            clauses.Add("g.MillId = @MillId");
            p.Add("MillId", mid);
        }
        if (!string.IsNullOrWhiteSpace(f.PoId) && int.TryParse(f.PoId, out var pid))
        {
            clauses.Add("g.POId = @PoId");
            p.Add("PoId", pid);
        }
        if (!string.IsNullOrWhiteSpace(f.GrnDate) && DateTime.TryParse(f.GrnDate, out var date))
        {
            clauses.Add("CAST(g.GRNDate AS DATE) = @GrnDate");
            p.Add("GrnDate", date.Date);
        }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            clauses.Add(@"(
                g.GRNNumber     LIKE @Search OR
                g.PONumber      LIKE @Search OR
                g.LotNumber     LIKE @Search OR
                g.VehicleNumber LIKE @Search OR
                mil.Name        LIKE @Search OR
                ISNULL(poi.Description, mat.Description) LIKE @Search
            )");
            p.Add("Search", $"%{f.Search}%");
        }

        return string.Join(" AND ", clauses);
    }
}
