using System.Data;
using Dapper;
using Monit.API.Common.Helpers;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Inventory;

public class DeliveryChallanRepository(DbConnectionFactory db) : IDeliveryChallanRepository
{
    // ── SELECT fragments ─────────────────────────────────────────────────────

    private const string HeaderSelect = @"
        SELECT
            dc.Id,
            dc.ChallanNumber,
            CONVERT(NVARCHAR(10), dc.ChallanDate, 23)              AS ChallanDate,
            dc.SalesOrderId,
            so.SONumber                                             AS SoNumber,
            dc.CustomerId,
            dc.CustomerName,
            dc.DeliveryMode,
            dc.DispatchedFrom,
            dc.VehicleNumber,
            dc.TransporterName,
            dc.LRNumber,
            dc.DriverName,
            dc.DriverPhone,
            dc.FreightAmount,
            dc.DeliveryAddress,
            dc.EWayBillNumber,
            dc.Remarks,
            dc.[Status],
            dc.CreatedAt,
            dc.CreatedBy,
            (SELECT COUNT(*) FROM inventory.DeliveryChallanItems i
              WHERE i.ChallanId = dc.Id AND i.IsDeleted = 0)         AS ItemCount,
            (SELECT ISNULL(SUM(i.QuantityKg), 0) FROM inventory.DeliveryChallanItems i
              WHERE i.ChallanId = dc.Id AND i.IsDeleted = 0)         AS TotalQuantityKg,
            -- PDF-only: borrowed from Customer master / linked SO (see DTO comment).
            c.GSTNo                                                 AS CustomerGstNo,
            c.BillingAddress                                        AS CustomerAddress,
            CONVERT(NVARCHAR(10), so.OrderDate, 23)                 AS SoOrderDate,
            ISNULL(so.PaymentTerms, c.PaymentTerms)                 AS PaymentTerms
        FROM   inventory.DeliveryChallans      dc
        LEFT JOIN sales.SalesOrders            so ON so.Id = dc.SalesOrderId
        LEFT JOIN masters.Customers            c  ON c.Id = dc.CustomerId";

    private const string ItemSelect = @"
        SELECT
            dci.Id,
            dci.ChallanId,
            dci.SalesOrderLineId,
            dci.StockLotId,
            dci.GrnId,
            dci.MaterialId,
            dci.Paper,
            dci.Gsm,
            dci.[Size],
            dci.QuantityKg,
            dci.Rate,
            dci.Remarks,
            sl.LotNumber,
            g.GRNNumber                         AS GrnNumber,
            g.PONumber                          AS PoNumber,
            sol.LineNumber                      AS SoLineNumber,
            hc.Code                             AS HsnCode,
            hc.GstPercent                       AS GstPercent
        FROM   inventory.DeliveryChallanItems  dci
        LEFT JOIN inventory.StockLots          sl  ON sl.Id  = dci.StockLotId
        LEFT JOIN inventory.GRNs               g   ON g.Id   = dci.GrnId
        LEFT JOIN sales.SalesOrderLines        sol ON sol.Id = dci.SalesOrderLineId
        LEFT JOIN masters.Materials            mat ON mat.Id = dci.MaterialId
        LEFT JOIN masters.HsnCodes             hc  ON hc.Id  = mat.HsnCodeId
        WHERE  dci.IsDeleted = 0";

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<PagedResult<DeliveryChallanDto>> GetAllAsync(DeliveryChallanFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "dc.Id") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM inventory.DeliveryChallans dc WHERE {where}";
        var dataSql  = $"{HeaderSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var rows  = (await conn.QueryAsync<DeliveryChallanDto>(dataSql, param)).ToList();

        if (rows.Count > 0) await AttachItems(conn, rows);

        return new PagedResult<DeliveryChallanDto> { Items = rows, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<DeliveryChallanDto?> GetByIdAsync(int id)
    {
        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync<DeliveryChallanDto>(
            $"{HeaderSelect} WHERE dc.Id = @Id AND dc.IsDeleted = 0",
            new { Id = id });

        if (row == null) return null;
        await AttachItems(conn, [row]);
        return row;
    }

    public async Task<List<OpenSoForDcDto>> GetOpenSosAsync(int? customerId)
    {
        // No quantity filtering here — OrderedQty can't be trusted at the SQL
        // level (see WeightCalculator.LineWeightKg). Candidate SOs are pulled
        // unfiltered on qty; pending-qty filtering happens in C# below once
        // the true kg weight has been recomputed per line.
        const string headerSql = @"
            SELECT
                so.Id                                       AS SalesOrderId,
                so.SONumber,
                CONVERT(NVARCHAR(10), so.OrderDate, 23)     AS OrderDate,
                so.CustomerId,
                c.[Name]                                    AS CustomerName,
                so.[Status],
                CONVERT(NVARCHAR(10), so.RequiredDeliveryDate, 23) AS RequiredDeliveryDate
            FROM   sales.SalesOrders        so
            LEFT JOIN masters.Customers     c   ON c.Id = so.CustomerId
            WHERE  so.IsDeleted = 0
              AND  so.[Status] NOT IN ('Completed','Cancelled','Closed')
              AND  (@CustomerId IS NULL OR so.CustomerId = @CustomerId)
              AND  EXISTS (SELECT 1 FROM sales.SalesOrderLines sol WHERE sol.SOId = so.Id AND sol.IsDeleted = 0)
              -- Hide SOs that already have an in-flight DC (Draft / Dispatched).
              -- The user finishes those from the main DC grid (mark Delivered) —
              -- which auto-closes the SO if fully delivered, or lets it reappear
              -- here if there's still leftover pending qty. Prevents the
              -- double-create-DC confusion the user reported.
              AND  NOT EXISTS (
                       SELECT 1 FROM inventory.DeliveryChallans dc
                       WHERE  dc.SalesOrderId = so.Id
                         AND  dc.IsDeleted    = 0
                         AND  dc.[Status]     IN ('Draft','Dispatched')
                   )
            ORDER BY so.OrderDate DESC, so.Id DESC";

        const string linesSql = @"
            SELECT
                sol.SOId                                AS SalesOrderId,
                sol.Id                                  AS SalesOrderLineId,
                sol.LineNumber,
                sol.MaterialId,
                m.Code                                  AS Paper,
                ISNULL(sol.GSM, m.GSM)                  AS Gsm,
                ISNULL(sol.[Size], ps.Label)           AS [Size],
                sol.Quantity                            AS StoredQty,
                sol.Qty                                 AS SheetQty,
                ISNULL(sol.DeliveredQty, 0)             AS DeliveredQty,
                sol.Rate,
                sol.DeliveryAddress
            FROM   sales.SalesOrderLines    sol
            LEFT JOIN masters.Materials     m  ON m.Id  = sol.MaterialId
            LEFT JOIN masters.PaperSizes    ps ON ps.Id = m.SizeId
            WHERE  sol.IsDeleted = 0
              AND  sol.SOId IN @SoIds
            ORDER BY sol.SOId, sol.LineNumber";

        using var conn = db.Create();
        var headers = (await conn.QueryAsync<OpenSoForDcDto>(headerSql, new { CustomerId = customerId })).ToList();
        if (headers.Count == 0) return headers;

        var soIds = headers.Select(h => h.SalesOrderId).ToList();
        var rawLines = (await conn.QueryAsync<OpenSoLineRawRow>(linesSql, new { SoIds = soIds })).ToList();

        var byHeader = rawLines
            .Select(r =>
            {
                var orderedQty = WeightCalculator.LineWeightKg(r.StoredQty, r.SheetQty, r.Gsm, r.Size);
                return new OpenSoLineForDcDto
                {
                    SalesOrderId     = r.SalesOrderId,
                    SalesOrderLineId = r.SalesOrderLineId,
                    LineNumber       = r.LineNumber,
                    MaterialId       = r.MaterialId,
                    Paper            = r.Paper,
                    Gsm              = r.Gsm,
                    Size             = r.Size,
                    OrderedQty       = orderedQty,
                    DeliveredQty     = r.DeliveredQty,
                    PendingQty       = orderedQty - r.DeliveredQty,
                    Rate             = r.Rate,
                    DeliveryAddress  = r.DeliveryAddress,
                };
            })
            .Where(l => l.PendingQty > 0)
            .GroupBy(l => l.SalesOrderId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<OpenSoForDcDto>();
        foreach (var h in headers)
        {
            if (!byHeader.TryGetValue(h.SalesOrderId, out var list) || list.Count == 0) continue;
            h.Lines             = list;
            h.TotalOrderedQty   = list.Sum(l => l.OrderedQty);
            h.TotalDeliveredQty = list.Sum(l => l.DeliveredQty);
            h.TotalPendingQty   = list.Sum(l => l.PendingQty);
            result.Add(h);
        }
        if (result.Count == 0) return result;

        // Batched availability check — same two sources the Create Challan
        // modal checks per-line via GetAvailableSourcesForSoLineAsync, but
        // computed once for every open SO here instead of N+1 calls, so the
        // list can show upfront which SOs actually have something to
        // deliver right now vs which are still waiting on a GRN.
        var materialIds = result.SelectMany(h => h.Lines).Select(l => l.MaterialId).Where(m => m.HasValue).Select(m => m!.Value).Distinct().ToList();
        var resultSoIds = result.Select(h => h.SalesOrderId).ToList();

        var stockMaterialIds = materialIds.Count == 0 ? [] : (await conn.QueryAsync<int>(@"
            SELECT DISTINCT MaterialId FROM inventory.StockLots
            WHERE IsDeleted = 0 AND AvailableQty > 0 AND MaterialId IN @MaterialIds",
            new { MaterialIds = materialIds })).ToHashSet();

        var directGrnPairs = (await conn.QueryAsync<(int SOId, int MaterialId)>(@"
            SELECT g.LinkedSOId AS SOId, g.MaterialId
            FROM   inventory.GRNs g
            OUTER APPLY (
                SELECT ISNULL(SUM(QuantityKg), 0) AS Used
                FROM   inventory.DeliveryChallanItems
                WHERE  GrnId = g.Id AND IsDeleted = 0
            ) consumed
            WHERE  g.IsDeleted = 0 AND g.LinkedSOId IN @SoIds
              AND  g.DirectQty > 0 AND (g.DirectQty - ISNULL(consumed.Used, 0)) > 0
            GROUP BY g.LinkedSOId, g.MaterialId",
            new { SoIds = resultSoIds })).ToHashSet();

        foreach (var h in result)
        {
            h.HasAvailableStock = h.Lines.Any(l =>
                l.MaterialId.HasValue &&
                (stockMaterialIds.Contains(l.MaterialId.Value) || directGrnPairs.Contains((h.SalesOrderId, l.MaterialId.Value))));
        }

        // Ready-to-deliver SOs first (so the user doesn't have to open
        // every one just to find out it has nothing to pick yet); within
        // each group, keep the original OrderDate DESC ordering.
        return result.OrderByDescending(h => h.HasAvailableStock).ToList();
    }

    private class OpenSoLineRawRow
    {
        public int      SalesOrderId     { get; set; }
        public int      SalesOrderLineId { get; set; }
        public int      LineNumber       { get; set; }
        public int?     MaterialId       { get; set; }
        public string?  Paper            { get; set; }
        public int?     Gsm              { get; set; }
        public string?  Size             { get; set; }
        public decimal  StoredQty        { get; set; }
        public int?     SheetQty         { get; set; }
        public decimal  DeliveredQty     { get; set; }
        public decimal? Rate             { get; set; }
        public string?  DeliveryAddress  { get; set; }
    }

    public async Task<List<AvailableStockSourceDto>> GetAvailableSourcesForSoLineAsync(int soLineId)
    {
        // Fetch the SO line's material AND its parent SO id. Stock lots are
        // pooled per material (anyone can pull from any matching lot), but
        // Direct-GRN portions were earmarked for a SPECIFIC customer order
        // at the time the GRN was created — they must NOT leak into other
        // SOs' delivery flows just because the material code happens to match.
        const string lineSql = @"SELECT MaterialId, SOId FROM sales.SalesOrderLines WHERE Id = @Id AND IsDeleted = 0";
        const string stockSql = @"
            SELECT
                sl.Id                                   AS StockLotId,
                sl.LotNumber,
                sl.WarehouseId,
                w.[Name]                                AS WarehouseName,
                bin.BinCode                             AS BinLocation,
                sl.FIFOSequence                         AS FifoSequence,
                CAST(NULL AS INT)                       AS GrnId,
                CAST(NULL AS NVARCHAR(20))              AS GrnNumber,
                CAST(NULL AS NVARCHAR(50))              AS PoNumber,
                sl.MaterialId,
                m.Code                                  AS Paper,
                sl.GSM                                  AS Gsm,
                ps.Label                               AS [Size],
                sl.AvailableQty,
                sl.CostPerUnit,
                'Stock'                                 AS SourceType
            FROM   inventory.StockLots          sl
            LEFT JOIN masters.Warehouses        w   ON w.Id   = sl.WarehouseId
            LEFT JOIN masters.WarehouseBins     bin ON bin.Id = sl.BinLocationId
            LEFT JOIN masters.Materials         m   ON m.Id   = sl.MaterialId
            LEFT JOIN masters.PaperSizes        ps  ON ps.Id  = sl.SizeId
            WHERE  sl.IsDeleted = 0
              AND  sl.MaterialId = @MaterialId
              AND  sl.AvailableQty > 0
            ORDER BY sl.FIFOSequence ASC";

        // GRNs with DirectToClient portion not yet consumed by another DC.
        // Paper/Size pulled from the Material master since GRNs row only stores MaterialId.
        // Transport snapshot (vehicle / LR / transporter / driver) flows down
        // from the parent DispatchReceipt so the DC form can auto-fill.
        const string grnSql = @"
            SELECT
                CAST(NULL AS INT)                       AS StockLotId,
                CAST(NULL AS NVARCHAR(50))              AS LotNumber,
                CAST(NULL AS INT)                       AS WarehouseId,
                CAST(NULL AS NVARCHAR(100))             AS WarehouseName,
                CAST(NULL AS NVARCHAR(50))              AS BinLocation,
                CAST(NULL AS INT)                       AS FifoSequence,
                g.Id                                    AS GrnId,
                g.GRNNumber                             AS GrnNumber,
                g.PONumber                              AS PoNumber,
                g.MaterialId,
                m.Code                                  AS Paper,
                g.GSM                                   AS Gsm,
                g.[Size],
                (g.DirectQty - ISNULL(consumed.Used, 0)) AS AvailableQty,
                CAST(NULL AS DECIMAL(18,2))             AS CostPerUnit,
                'DirectGrn'                             AS SourceType,
                -- Vehicle / LR live on the GRN (and dispatch). Transporter /
                -- driver live on the parent TruckLoadPlan (filled when the
                -- planner created the truck). Coalesce so whichever value
                -- exists flows down to the DC form.
                ISNULL(g.VehicleNumber, ISNULL(dr.VehicleNumber, tlp.TruckNumber)) AS VehicleNumber,
                ISNULL(g.LRNumber,      dr.LRNumber)                               AS LRNumber,
                tlp.TransporterName                                                AS TransporterName,
                tlp.DriverName                                                     AS DriverName,
                tlp.DriverPhone                                                    AS DriverPhone
            FROM   inventory.GRNs g
            LEFT JOIN masters.Materials             m   ON m.Id   = g.MaterialId
            LEFT JOIN inventory.DispatchReceipts    dr  ON dr.Id  = g.DispatchReceiptId AND dr.IsDeleted = 0
            LEFT JOIN procurement.TruckLoadPlans    tlp ON tlp.Id = g.SourceLoadPlanId  AND tlp.IsDeleted = 0
            OUTER APPLY (
                SELECT ISNULL(SUM(QuantityKg), 0) AS Used
                FROM   inventory.DeliveryChallanItems
                WHERE  GrnId = g.Id AND IsDeleted = 0
            ) consumed
            WHERE  g.IsDeleted = 0
              AND  g.MaterialId = @MaterialId
              AND  g.LinkedSOId = @SoId               -- scope: this SO only
              AND  g.DirectQty > 0
              AND  (g.DirectQty - ISNULL(consumed.Used, 0)) > 0
            ORDER BY g.CreatedAt DESC";

        using var conn = db.Create();
        var lineInfo = await conn.QueryFirstOrDefaultAsync<(int? MaterialId, int? SOId)>(lineSql, new { Id = soLineId });
        if (!lineInfo.MaterialId.HasValue || !lineInfo.SOId.HasValue) return [];

        var stock  = (await conn.QueryAsync<AvailableStockSourceDto>(stockSql, new { MaterialId = lineInfo.MaterialId.Value })).ToList();
        var direct = (await conn.QueryAsync<AvailableStockSourceDto>(grnSql,   new { MaterialId = lineInfo.MaterialId.Value, SoId = lineInfo.SOId.Value })).ToList();
        return stock.Concat(direct).ToList();
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    public async Task<int> CreateAsync(CreateDeliveryChallanDto dto, string challanNumber, string createdBy)
    {
        const string insertHeader = @"
            INSERT INTO inventory.DeliveryChallans
                (ChallanNumber, ChallanDate, SalesOrderId, CustomerId, CustomerName,
                 DeliveryMode, DispatchedFrom, VehicleNumber, TransporterName, LRNumber,
                 DriverName, DriverPhone, FreightAmount, DeliveryAddress, EWayBillNumber,
                 Remarks, [Status], CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@ChallanNumber, @ChallanDate, @SalesOrderId, @CustomerId, @CustomerName,
                 @DeliveryMode, @DispatchedFrom, @VehicleNumber, @TransporterName, @LRNumber,
                 @DriverName, @DriverPhone, @FreightAmount, @DeliveryAddress, @EWayBillNumber,
                 @Remarks, 'Draft', GETUTCDATE(), @CreatedBy)";

        const string insertItem = @"
            INSERT INTO inventory.DeliveryChallanItems
                (ChallanId, SalesOrderLineId, StockLotId, GrnId, MaterialId,
                 Paper, Gsm, [Size], QuantityKg, Rate, Remarks, CreatedAt, CreatedBy)
            VALUES
                (@ChallanId, @SalesOrderLineId, @StockLotId, @GrnId, @MaterialId,
                 @Paper, @Gsm, @Size, @QuantityKg, @Rate, @Remarks, GETUTCDATE(), @CreatedBy)";

        // Snapshot SO-line data into item rows (so the DC stays display-correct
        // even if the SO line is later edited).
        const string snapshotSql = @"
            SELECT sol.MaterialId, m.Code AS Paper, ISNULL(sol.GSM, m.GSM) AS Gsm, ISNULL(sol.[Size], ps.Label) AS [Size]
            FROM   sales.SalesOrderLines sol
            LEFT JOIN masters.Materials  m  ON m.Id  = sol.MaterialId
            LEFT JOIN masters.PaperSizes ps ON ps.Id = m.SizeId
            WHERE  sol.Id = @Id";

        // Customer name snapshot
        const string custNameSql = "SELECT [Name] FROM masters.Customers WHERE Id = @Id";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Resolve customer name (denormalised snapshot)
            var customerName = await conn.ExecuteScalarAsync<string?>(custNameSql, new { Id = dto.CustomerId }, tx);

            // Validate every line still has enough pending qty + decide DeliveryMode.
            var hasStock  = dto.Items.Any(i => i.StockLotId.HasValue);
            var hasDirect = dto.Items.Any(i => i.GrnId.HasValue);
            var mode = (hasStock, hasDirect) switch
            {
                (true, true)  => "Mixed",
                (false, true) => "DirectFromMill",
                _             => "FromStock",
            };

            var id = await conn.ExecuteScalarAsync<int>(insertHeader, new
            {
                ChallanNumber   = challanNumber,
                ChallanDate     = ParseDateOnly(dto.ChallanDate),
                dto.SalesOrderId,
                dto.CustomerId,
                CustomerName    = customerName,
                DeliveryMode    = mode,
                dto.DispatchedFrom,
                dto.VehicleNumber,
                dto.TransporterName,
                dto.LRNumber,
                dto.DriverName,
                dto.DriverPhone,
                dto.FreightAmount,
                dto.DeliveryAddress,
                dto.EWayBillNumber,
                dto.Remarks,
                CreatedBy       = createdBy,
            }, tx);

            foreach (var it in dto.Items)
            {
                var snap = await conn.QueryFirstOrDefaultAsync<dynamic>(snapshotSql, new { Id = it.SalesOrderLineId }, tx);

                await conn.ExecuteAsync(insertItem, new
                {
                    ChallanId        = id,
                    it.SalesOrderLineId,
                    it.StockLotId,
                    it.GrnId,
                    MaterialId       = (int?)(snap?.MaterialId),
                    Paper            = (string?)(snap?.Paper),
                    Gsm              = (int?)(snap?.Gsm),
                    Size             = (string?)(snap?.Size),
                    it.QuantityKg,
                    it.Rate,
                    it.Remarks,
                    CreatedBy        = createdBy,
                }, tx);

                // ── Decrement StockLot when sourced from stock ───────────────
                if (it.StockLotId.HasValue)
                {
                    var lockedLot = await conn.QueryFirstOrDefaultAsync<(decimal AvailableQty, decimal CurrentQty)>(
                        "SELECT AvailableQty, CurrentQty FROM inventory.StockLots WITH (UPDLOCK, HOLDLOCK) WHERE Id = @Id AND IsDeleted = 0",
                        new { Id = it.StockLotId.Value }, tx);

                    if (lockedLot.AvailableQty < it.QuantityKg)
                    {
                        // Throw only — the outer catch handles the rollback. A
                        // second Rollback() call here would fail because the
                        // first rollback would already have completed the tx.
                        throw new Common.Middleware.ConflictException(
                            $"Stock lot has only {lockedLot.AvailableQty:N3} kg available — cannot ship {it.QuantityKg:N3} kg.");
                    }

                    var newCurrent = lockedLot.CurrentQty - it.QuantityKg;
                    var newStatus  = newCurrent <= 0 ? "Depleted" : "Available";

                    // AvailableQty is a computed column (CurrentQty - ReservedQty)
                    // in inventory.StockLots — we only write CurrentQty and let
                    // the DB derive AvailableQty.
                    await conn.ExecuteAsync(@"
                        UPDATE inventory.StockLots
                        SET    CurrentQty = @NewCurrent,
                               [Status]   = @NewStatus,
                               UpdatedAt  = GETUTCDATE(),
                               UpdatedBy  = @By
                        WHERE  Id = @Id",
                        new
                        {
                            Id         = it.StockLotId.Value,
                            NewCurrent = newCurrent,
                            NewStatus  = newStatus,
                            By         = createdBy,
                        }, tx);
                }

                // ── For direct-from-GRN, validate not over-consuming ─────────
                if (it.GrnId.HasValue)
                {
                    // `Consumed` already includes the row we just inserted above,
                    // so total used (including this DC) must not exceed DirectQty.
                    var grnInfo = await conn.QueryFirstOrDefaultAsync<(decimal DirectQty, decimal Consumed)>(
                        @"SELECT g.DirectQty,
                                 ISNULL((SELECT SUM(QuantityKg) FROM inventory.DeliveryChallanItems
                                          WHERE GrnId = g.Id AND IsDeleted = 0), 0) AS Consumed
                          FROM   inventory.GRNs g WITH (UPDLOCK, HOLDLOCK)
                          WHERE  g.Id = @Id AND g.IsDeleted = 0",
                        new { Id = it.GrnId.Value }, tx);

                    if (grnInfo.Consumed > grnInfo.DirectQty)
                    {
                        // Throw only — outer catch handles rollback (see note above).
                        var unallocatedBefore = grnInfo.DirectQty - (grnInfo.Consumed - it.QuantityKg);
                        throw new Common.Middleware.ConflictException(
                            $"GRN direct-to-client portion only has {unallocatedBefore:N3} kg unallocated — cannot ship {it.QuantityKg:N3} kg.");
                    }
                }

                // ── Bump SOLine DeliveredQty ─────────────────────────────────
                await conn.ExecuteAsync(@"
                    UPDATE sales.SalesOrderLines
                    SET    DeliveredQty = ISNULL(DeliveredQty, 0) + @Qty,
                           UpdatedAt    = GETUTCDATE(),
                           UpdatedBy    = @By
                    WHERE  Id = @Id AND IsDeleted = 0",
                    new { Id = it.SalesOrderLineId, Qty = it.QuantityKg, By = createdBy }, tx);
            }

            // NOTE: SO auto-close happens in UpdateStatusAsync when the DC
            // moves to 'Delivered' — NOT here on create. A freshly-created
            // 'Draft' DC means the truck hasn't left yet; closing the SO at
            // that point would incorrectly mark the order Closed before the
            // material has physically reached the customer.

            tx.Commit();
            return id;
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateStatusAsync(int id, string status, string? remarks, string updatedBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(@"
                UPDATE inventory.DeliveryChallans
                SET    [Status]  = @Status,
                       Remarks   = ISNULL(@Remarks, Remarks),
                       UpdatedAt = GETUTCDATE(),
                       UpdatedBy = @By
                WHERE  Id = @Id AND IsDeleted = 0",
                new { Id = id, Status = status, Remarks = remarks, By = updatedBy }, tx);

            // When the DC reaches 'Delivered' status, check whether every line
            // of the parent SO is now fully delivered. If yes, auto-close the
            // SO so the user doesn't have to click anywhere else.
            if (string.Equals(status, "Delivered", StringComparison.OrdinalIgnoreCase))
            {
                var soId = await conn.ExecuteScalarAsync<int?>(
                    "SELECT SalesOrderId FROM inventory.DeliveryChallans WHERE Id = @Id AND IsDeleted = 0",
                    new { Id = id }, tx);

                if (soId.HasValue)
                {
                    var pending = await conn.ExecuteScalarAsync<int>(@"
                        SELECT COUNT(*) FROM sales.SalesOrderLines
                        WHERE  SOId = @SoId AND IsDeleted = 0
                          AND  ISNULL(Quantity, Qty) > ISNULL(DeliveredQty, 0)",
                        new { SoId = soId.Value }, tx);

                    if (pending == 0)
                    {
                        await conn.ExecuteAsync(@"
                            UPDATE sales.SalesOrders
                            SET    [Status]  = 'Closed',
                                   UpdatedAt = GETUTCDATE(),
                                   UpdatedBy = @By
                            WHERE  Id = @Id AND [Status] NOT IN ('Completed','Cancelled','Closed')",
                            new { Id = soId.Value, By = updatedBy }, tx);
                    }
                }
            }

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Restore stock + decrement SOLine.DeliveredQty before marking the DC deleted.
            var items = (await conn.QueryAsync<(int SalesOrderLineId, int? StockLotId, decimal QuantityKg)>(
                "SELECT SalesOrderLineId, StockLotId, QuantityKg FROM inventory.DeliveryChallanItems WHERE ChallanId = @Id AND IsDeleted = 0",
                new { Id = id }, tx)).ToList();

            int? soId = await conn.ExecuteScalarAsync<int?>(
                "SELECT SalesOrderId FROM inventory.DeliveryChallans WHERE Id = @Id",
                new { Id = id }, tx);

            foreach (var it in items)
            {
                if (it.StockLotId.HasValue)
                {
                    await conn.ExecuteAsync(@"
                        UPDATE inventory.StockLots
                        SET    CurrentQty = CurrentQty + @Qty,
                               [Status]  = 'Available',
                               UpdatedAt = GETUTCDATE(),
                               UpdatedBy = @By
                        WHERE  Id = @Id",
                        new { Id = it.StockLotId.Value, Qty = it.QuantityKg, By = deletedBy }, tx);
                }

                await conn.ExecuteAsync(@"
                    UPDATE sales.SalesOrderLines
                    SET    DeliveredQty = CASE WHEN ISNULL(DeliveredQty, 0) - @Qty < 0 THEN 0
                                               ELSE ISNULL(DeliveredQty, 0) - @Qty END,
                           UpdatedAt    = GETUTCDATE(),
                           UpdatedBy    = @By
                    WHERE  Id = @Id AND IsDeleted = 0",
                    new { Id = it.SalesOrderLineId, Qty = it.QuantityKg, By = deletedBy }, tx);
            }

            await conn.ExecuteAsync(
                "UPDATE inventory.DeliveryChallans SET IsDeleted = 1, DeletedAt = GETUTCDATE(), DeletedBy = @By WHERE Id = @Id AND IsDeleted = 0",
                new { Id = id, By = deletedBy }, tx);

            await conn.ExecuteAsync(
                "UPDATE inventory.DeliveryChallanItems SET IsDeleted = 1 WHERE ChallanId = @Id AND IsDeleted = 0",
                new { Id = id }, tx);

            // If the SO was auto-closed by this DC, reopen it — but only if it
            // genuinely still has pending qty. OrderedQty can't be trusted at
            // the SQL level (see WeightCalculator.LineWeightKg), so fetch the
            // raw components and recompute in C# instead of an EXISTS(...).
            if (soId.HasValue)
            {
                var soLines = await conn.QueryAsync<(decimal StoredQty, int? SheetQty, int? Gsm, string? Size, decimal DeliveredQty)>(@"
                    SELECT sol.Quantity AS StoredQty, sol.Qty AS SheetQty, sol.GSM AS Gsm, sol.[Size] AS Size,
                           ISNULL(sol.DeliveredQty, 0) AS DeliveredQty
                    FROM   sales.SalesOrderLines sol
                    WHERE  sol.SOId = @SoId AND sol.IsDeleted = 0",
                    new { SoId = soId.Value }, tx);
                var hasPending = soLines.Any(l =>
                    WeightCalculator.LineWeightKg(l.StoredQty, l.SheetQty, l.Gsm, l.Size) > l.DeliveredQty);

                await conn.ExecuteAsync(@"
                    UPDATE sales.SalesOrders
                    SET    [Status]  = CASE WHEN @HasPending = 1 THEN 'Partially Delivered' ELSE [Status] END,
                           UpdatedAt = GETUTCDATE(),
                           UpdatedBy = @By
                    WHERE  Id = @SoId AND [Status] IN ('Completed', 'Closed')",
                    new { SoId = soId.Value, HasPending = hasPending, By = deletedBy }, tx);
            }

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    // ── Auto-create from GRN (direct-to-client portion) ──────────────────────

    public async Task<int?> AutoCreateDraftFromGrnAsync(int grnId, decimal directQty, string challanNumber, string createdBy)
    {
        if (directQty <= 0) return null;

        // Resolve the SO line to credit: GRN → MillTracker → LinkedSO → matching open line
        // with the same material. If the SO has multiple matching lines, prefer the one
        // with the most pending qty so the auto-DC absorbs as much as possible.
        // Paper/Gsm/Size are pulled from the Material master since the GRN row stores
        // only MaterialId (no denormalised description columns).
        // OrderedQty can't be trusted at the SQL level (see
        // WeightCalculator.LineWeightKg), so pending qty is picked in C# below
        // instead of an ORDER BY / TOP 1 on the raw stored value.
        const string lookupSql = @"
            SELECT
                sol.Id                              AS SalesOrderLineId,
                sol.SOId                            AS SalesOrderId,
                so.CustomerId                       AS CustomerId,
                c.[Name]                            AS CustomerName,
                g.MaterialId                        AS MaterialId,
                m.Code                              AS Paper,
                m.GSM                               AS Gsm,
                ps.Label                           AS [Size],
                sol.Quantity                        AS StoredQty,
                sol.Qty                             AS SheetQty,
                ISNULL(sol.DeliveredQty, 0)         AS DeliveredQty,
                sol.LineNumber                      AS LineNumber,
                g.DirectClientName                  AS GrnDirectClientName
            FROM   inventory.GRNs              g
            JOIN   procurement.MillTrackers    mt  ON mt.Id   = g.MillTrackerId
            JOIN   sales.SalesOrders           so  ON so.Id   = mt.LinkedSOId
            JOIN   sales.SalesOrderLines       sol ON sol.SOId = so.Id AND sol.MaterialId = g.MaterialId
            LEFT JOIN masters.Materials        m   ON m.Id    = g.MaterialId
            LEFT JOIN masters.PaperSizes       ps  ON ps.Id   = m.SizeId
            LEFT JOIN masters.Customers        c   ON c.Id    = so.CustomerId
            WHERE  g.Id = @GrnId
              AND  so.IsDeleted = 0
              AND  sol.IsDeleted = 0
              AND  so.[Status] NOT IN ('Completed','Cancelled','Closed')
            ORDER BY sol.LineNumber ASC";

        using var conn = db.Create();
        var candidates = (await conn.QueryAsync<dynamic>(lookupSql, new { GrnId = grnId })).ToList();

        dynamic? link = null;
        decimal pending = 0;
        foreach (var c in candidates)
        {
            var orderedQty = WeightCalculator.LineWeightKg((decimal)c.StoredQty, (int?)c.SheetQty, (int?)c.Gsm, (string?)c.Size);
            var candidatePending = orderedQty - (decimal)c.DeliveredQty;
            if (candidatePending <= 0) continue;
            if (link == null || candidatePending > pending)
            {
                link    = c;
                pending = candidatePending;
            }
        }
        if (link == null) return null;

        int    salesOrderId     = (int)link.SalesOrderId;
        int    customerId       = (int)link.CustomerId;
        int    salesOrderLineId = (int)link.SalesOrderLineId;
        string? customerName    = link.CustomerName as string ?? link.GrnDirectClientName as string;
        int?   materialId       = link.MaterialId;
        string? paper           = link.Paper as string;
        int?   gsm              = link.Gsm;
        string? size            = link.Size as string;

        // Cap the auto-DC qty at the SO line's pending qty so we never overshoot.
        var qty = Math.Min(directQty, pending);
        if (qty <= 0) return null;

        using var tx = conn.BeginTransaction();
        try
        {
            var dcId = await conn.ExecuteScalarAsync<int>(@"
                INSERT INTO inventory.DeliveryChallans
                    (ChallanNumber, ChallanDate, SalesOrderId, CustomerId, CustomerName,
                     DeliveryMode, DispatchedFrom, Remarks,
                     [Status], CreatedAt, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES
                    (@ChallanNumber, CAST(GETUTCDATE() AS DATE), @SalesOrderId, @CustomerId, @CustomerName,
                     'DirectFromMill', 'Direct from mill (auto)',
                     'Auto-created from GRN direct-to-client portion. Review and fill in transport details, then mark Dispatched.',
                     'Draft', GETUTCDATE(), @CreatedBy)",
                new
                {
                    ChallanNumber = challanNumber,
                    SalesOrderId  = salesOrderId,
                    CustomerId    = customerId,
                    CustomerName  = customerName,
                    CreatedBy     = createdBy,
                }, tx);

            await conn.ExecuteAsync(@"
                INSERT INTO inventory.DeliveryChallanItems
                    (ChallanId, SalesOrderLineId, GrnId, MaterialId,
                     Paper, Gsm, [Size], QuantityKg, CreatedAt, CreatedBy)
                VALUES
                    (@ChallanId, @SalesOrderLineId, @GrnId, @MaterialId,
                     @Paper, @Gsm, @Size, @Qty, GETUTCDATE(), @CreatedBy)",
                new
                {
                    ChallanId        = dcId,
                    SalesOrderLineId = salesOrderLineId,
                    GrnId            = grnId,
                    MaterialId       = materialId,
                    Paper            = paper,
                    Gsm              = gsm,
                    Size             = size,
                    Qty              = qty,
                    CreatedBy        = createdBy,
                }, tx);

            // Bump SOLine.DeliveredQty — the goods physically left the mill, so we credit
            // the SO line immediately. The Draft status only gates the transport paper trail.
            await conn.ExecuteAsync(@"
                UPDATE sales.SalesOrderLines
                SET    DeliveredQty = ISNULL(DeliveredQty, 0) + @Qty,
                       UpdatedAt    = GETUTCDATE(),
                       UpdatedBy    = @By
                WHERE  Id = @Id AND IsDeleted = 0",
                new { Id = salesOrderLineId, Qty = qty, By = createdBy }, tx);

            // NOTE: Same as CreateAsync — SO auto-close is deferred to
            // UpdateStatusAsync so the order doesn't close while the DC is
            // still in Draft (i.e. before the truck has actually delivered).

            tx.Commit();
            return dcId;
        }
        catch { tx.Rollback(); throw; }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task AttachItems(IDbConnection conn, List<DeliveryChallanDto> headers)
    {
        var ids = headers.Select(h => h.Id).ToList();
        var items = (await conn.QueryAsync<DeliveryChallanItemDto>(
            $"{ItemSelect} AND dci.ChallanId IN @Ids ORDER BY dci.ChallanId, dci.Id",
            new { Ids = ids })).ToList();

        var map = items.GroupBy(i => i.ChallanId).ToDictionary(g => g.Key, g => g.ToList());
        foreach (var h in headers)
            h.Items = map.TryGetValue(h.Id, out var list) ? list : [];
    }

    private static (string, DynamicParameters) BuildWhere(DeliveryChallanFilterRequest f)
    {
        var parts = new List<string> { "dc.IsDeleted = 0" };
        var p     = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            parts.Add("dc.[Status] = @Status");
            p.Add("Status", f.Status);
        }
        if (f.SalesOrderId.HasValue)
        {
            parts.Add("dc.SalesOrderId = @SoId");
            p.Add("SoId", f.SalesOrderId.Value);
        }
        if (f.CustomerId.HasValue)
        {
            parts.Add("dc.CustomerId = @CustId");
            p.Add("CustId", f.CustomerId.Value);
        }
        if (!string.IsNullOrWhiteSpace(f.ChallanNumber))
        {
            parts.Add("dc.ChallanNumber LIKE @Chl");
            p.Add("Chl", $"%{f.ChallanNumber.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(dc.ChallanNumber LIKE @Search OR dc.CustomerName LIKE @Search OR dc.VehicleNumber LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.FromDate))
        {
            parts.Add("dc.ChallanDate >= @FromDate");
            p.Add("FromDate", DateOnly.Parse(f.FromDate));
        }
        if (!string.IsNullOrWhiteSpace(f.ToDate))
        {
            parts.Add("dc.ChallanDate <= @ToDate");
            p.Add("ToDate", DateOnly.Parse(f.ToDate));
        }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "dc.Id", "dc.ChallanDate", "dc.CreatedAt", "dc.[Status]" };

    private static string SafeColumn(string? col, string def)
    {
        if (string.IsNullOrEmpty(col)) return def;
        var qualified = col.Contains('.') ? col : $"dc.{col}";
        return AllowedSort.Contains(qualified) ? qualified : def;
    }

    private static DateOnly? ParseDateOnly(string? val)
        => string.IsNullOrWhiteSpace(val) ? null : DateOnly.Parse(val);
}
