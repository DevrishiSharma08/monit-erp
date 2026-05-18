using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Procurement;

public class MillTrackerRepository(DbConnectionFactory db) : IMillTrackerRepository
{
    // ── Core SELECT ──────────────────────────────────────────────────────────

    // ── All data resolved via JOINs — no dependency on migration-12 columns ──
    private const string TrackerSelect = @"
        SELECT
            mt.Id,
            mt.POId                                                                     AS PoId,
            mt.POItemId                                                                 AS PoItemId,
            po.PONumber                                                                 AS PoNumber,
            CONVERT(NVARCHAR(10), ISNULL(mt.PODate, po.OrderDate), 23)                 AS PoDate,
            mt.MillId,
            mil.Name                                                                    AS Mill,
            mt.MaterialId,
            ISNULL(poi.Description, mat.Description)                                   AS Paper,
            ISNULL(poi.GSM,         mat.GSM)                                            AS Gsm,
            poi.Size                                                                    AS Size,
            mt.OrderedQty,
            mt.ReadyQty,
            mt.DispatchedQty,
            ISNULL(mt.Rate,        ISNULL(poi.Rate,   0))                              AS Rate,
            ISNULL(mt.TotalAmount, ISNULL(poi.Amount, 0))                              AS TotalAmount,
            mt.ProductionStatus,
            ISNULL(mt.ProductionProgress, 0)                                           AS ProductionProgress,
            mt.OrderedQty - mt.DispatchedQty                                               AS BalanceQty,
            CONVERT(NVARCHAR(10), ISNULL(mt.ExpectedDelivery, po.ExpectedDeliveryDate), 23) AS ExpectedDelivery,
            CONVERT(NVARCHAR(10), mt.ActualDispatchDate, 23)                           AS ActualDispatchDate,
            CONVERT(NVARCHAR(24), mt.LastUpdate, 126)                                  AS LastUpdate,
            mt.LastUpdatedBy,
            mt.DelayDays,
            mt.LinkedSOId,
            ISNULL(mt.DeliveryMode, po.DeliveryMode)                                  AS DeliveryMode,
            mt.MillInvoiceNo,
            ISNULL(mt.CustomerName, dc.Name)                                           AS CustomerName,
            ISNULL(mt.CustomerId,   po.DirectCustomerId)                               AS CustomerId,
            so.SONumber                                                                AS SoNumber,
            CONVERT(NVARCHAR(10), so.RequiredDeliveryDate, 23)                        AS SoDeliveryDate,
            po.DirectCustomerId                                                        AS SoCustomerId,
            soc.Name                                                                   AS SoCustomerName,
            mt.Remarks,
            po.MillSONumber,
            po.DirectDeliveryAddress,
            mt.CreatedAt
        FROM  procurement.MillTrackers           mt
        JOIN  masters.Mills                      mil ON mil.Id  = mt.MillId
        LEFT JOIN masters.Materials              mat ON mat.Id  = mt.MaterialId
        LEFT JOIN procurement.PurchaseOrders     po  ON po.Id   = mt.POId  AND po.IsDeleted = 0
        LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id  = mt.POItemId
        LEFT JOIN masters.Customers              dc  ON dc.Id   = po.DirectCustomerId
        LEFT JOIN sales.SalesOrders              so  ON so.Id   = mt.LinkedSOId
        LEFT JOIN masters.Customers              soc ON soc.Id  = so.CustomerId";

    private const string BatchSelect = @"
        SELECT
            pd.Id,
            pd.TrackerId,
            ISNULL(pd.BatchNo, 0)                                AS BatchNo,
            CONVERT(NVARCHAR(10), pd.DeliveryDate, 23)           AS DeliveryDate,
            pd.Quantity,
            pd.LRNumber                                          AS LrNumber,
            pd.TruckNumber,
            pd.VehicleNumber,
            pd.MillInvoiceNo,
            pd.Remarks,
            pd.CreatedAt,
            pd.CreatedBy
        FROM procurement.MillTrackerPartialDeliveries pd
        WHERE pd.IsDeleted = 0";

    private const string HistorySelect = @"
        SELECT
            h.Id,
            h.TrackerId,
            h.Action,
            h.OldStatus,
            h.[Status]          AS NewStatus,
            h.OldQty,
            h.NewQty,
            h.ReadyQty,
            h.DispatchedQty,
            h.Note              AS Remarks,
            h.UpdatedBy,
            h.UpdatedAt
        FROM procurement.MillTrackerHistory h";

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<PagedResult<MillTrackerListDto>> GetAllAsync(MillTrackerFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "mt.CreatedAt") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM procurement.MillTrackers mt WHERE {where}";
        var dataSql  = $"{TrackerSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total   = await conn.ExecuteScalarAsync<int>(countSql, param);
        var trackers = (await conn.QueryAsync<MillTrackerListDto>(dataSql, param)).ToList();

        if (trackers.Count > 0) await AttachChildren(conn, trackers);

        return new PagedResult<MillTrackerListDto> { Items = trackers, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<MillTrackerListDto?> GetByIdAsync(int id)
    {
        using var conn   = db.Create();
        var tracker = await conn.QueryFirstOrDefaultAsync<MillTrackerListDto>(
            $"{TrackerSelect} WHERE mt.Id=@Id AND mt.IsDeleted=0", new { Id = id });

        if (tracker == null) return null;

        await AttachChildren(conn, [tracker]);
        return tracker;
    }

    public async Task<List<MillTrackerListDto>> GetByPoIdAsync(int poId)
    {
        using var conn   = db.Create();
        var trackers = (await conn.QueryAsync<MillTrackerListDto>(
            $"{TrackerSelect} WHERE mt.POId=@PoId AND mt.IsDeleted=0 ORDER BY mt.Id",
            new { PoId = poId })).ToList();

        if (trackers.Count > 0)
            await AttachChildren(conn, trackers);

        return trackers;
    }

    public async Task<List<MillTrackerListDto>> GetByPoNumberAsync(string poNumber)
    {
        using var conn = db.Create();
        var trackers = (await conn.QueryAsync<MillTrackerListDto>(
            $"{TrackerSelect} WHERE po.PONumber=@PoNumber AND mt.IsDeleted=0 ORDER BY mt.Id",
            new { PoNumber = poNumber })).ToList();
        return trackers;
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    public async Task CreateForPoAsync(PurchaseOrderListDto po, string createdBy)
    {
        // Only original schema columns — works with or without migration 12
        const string insertSql = @"
            INSERT INTO procurement.MillTrackers
                (POId, POItemId, MillId, PODate, MaterialId,
                 OrderedQty, ReadyQty, DispatchedQty,
                 Rate, TotalAmount,
                 ProductionStatus, ProductionProgress,
                 ExpectedDelivery, LinkedSOId, DeliveryMode,
                 CustomerName, CustomerId,
                 CreatedAt, CreatedBy)
            VALUES
                (@POId, @POItemId, @MillId, @PODate, @MaterialId,
                 @OrderedQty, 0, 0,
                 @Rate, @TotalAmount,
                 'Order Placed', 0,
                 @ExpectedDelivery, @LinkedSOId, @DeliveryMode,
                 @CustomerName, @CustomerId,
                 GETUTCDATE(), @CreatedBy)";

        var poDate           = string.IsNullOrEmpty(po.OrderDate) ? (DateOnly?)null : DateOnly.Parse(po.OrderDate);
        var expectedDelivery = string.IsNullOrEmpty(po.ExpectedDeliveryDate) ? (DateOnly?)null : DateOnly.Parse(po.ExpectedDeliveryDate);

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            foreach (var item in po.Items)
            {
                if (item.MaterialId <= 0) continue; // FK requires valid material
                var orderedQty = item.WeightKg.HasValue && item.WeightKg > 0 ? item.WeightKg.Value : item.Quantity;
                await conn.ExecuteAsync(insertSql, new
                {
                    POId             = po.Id,
                    POItemId         = item.Id,
                    po.MillId,
                    PODate           = poDate,
                    MaterialId       = item.MaterialId,
                    OrderedQty       = orderedQty,
                    item.Rate,
                    TotalAmount      = item.Amount,
                    ExpectedDelivery = expectedDelivery,
                    LinkedSOId       = po.LinkedSOId,
                    po.DeliveryMode,
                    CustomerName     = po.DirectCustomer,
                    CustomerId       = po.DirectCustomerId,
                    CreatedBy        = createdBy,
                }, tx);
            }
            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateStatusAsync(int id, UpdateMillTrackerStatusDto dto, string updatedBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Read old status for history
            var oldStatus = await conn.ExecuteScalarAsync<string>(
                "SELECT ProductionStatus FROM procurement.MillTrackers WHERE Id=@Id AND IsDeleted=0", new { Id = id }, tx);
            var oldReady = await conn.ExecuteScalarAsync<decimal>(
                "SELECT ReadyQty FROM procurement.MillTrackers WHERE Id=@Id AND IsDeleted=0", new { Id = id }, tx);

            var updateParts = new List<string>
            {
                "ProductionStatus=@Status",
                "LastUpdate=GETUTCDATE()",
                "LastUpdatedBy=@UpdatedBy",
                "UpdatedAt=GETUTCDATE()",
                "UpdatedBy=@UpdatedBy",
            };
            if (dto.Progress.HasValue)                    updateParts.Add("ProductionProgress=@Progress");
            if (dto.ReadyQty.HasValue)                    updateParts.Add("ReadyQty=@ReadyQty");
            if (!string.IsNullOrEmpty(dto.ExpectedDelivery)) updateParts.Add("ExpectedDelivery=@ExpectedDelivery");

            var expDelivery = string.IsNullOrEmpty(dto.ExpectedDelivery) ? (DateOnly?)null : DateOnly.Parse(dto.ExpectedDelivery);
            await conn.ExecuteAsync(
                $"UPDATE procurement.MillTrackers SET {string.Join(", ", updateParts)} WHERE Id=@Id AND IsDeleted=0",
                new { Id = id, dto.Status, UpdatedBy = updatedBy, dto.Progress, ReadyQty = dto.ReadyQty, ExpectedDelivery = expDelivery }, tx);

            // Append history
            await conn.ExecuteAsync(@"
                INSERT INTO procurement.MillTrackerHistory
                    (TrackerId, Action, OldStatus, [Status], OldQty, NewQty, Note, UpdatedBy, UpdatedAt, CreatedAt, CreatedBy)
                VALUES
                    (@TrackerId, 'StatusChange', @OldStatus, @NewStatus, @OldQty, @NewQty, @Note, @UpdatedBy, GETUTCDATE(), GETUTCDATE(), @UpdatedBy)",
                new
                {
                    TrackerId  = id,
                    OldStatus  = oldStatus,
                    NewStatus  = dto.Status,
                    OldQty     = oldReady,
                    NewQty     = dto.ReadyQty ?? oldReady,
                    Note       = dto.Note,
                    UpdatedBy  = updatedBy,
                }, tx);

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task<MillTrackerBatchDto> AddBatchAsync(int id, AddMillTrackerBatchDto batch, string createdBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Next batch number for this tracker
            var batchNo = await conn.ExecuteScalarAsync<int>(
                "SELECT ISNULL(MAX(BatchNo), 0) + 1 FROM procurement.MillTrackerPartialDeliveries WHERE TrackerId=@Id AND IsDeleted=0",
                new { Id = id }, tx);

            var batchId = await conn.ExecuteScalarAsync<int>(@"
                INSERT INTO procurement.MillTrackerPartialDeliveries
                    (TrackerId, BatchNo, DeliveryDate, Quantity, LRNumber, TruckNumber, VehicleNumber, MillInvoiceNo, Remarks, CreatedAt, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES
                    (@TrackerId, @BatchNo, @DeliveryDate, @Quantity, @LRNumber, @TruckNumber, @VehicleNumber, @MillInvoiceNo, @Remarks, GETUTCDATE(), @CreatedBy)",
                new
                {
                    TrackerId    = id,
                    BatchNo      = batchNo,
                    DeliveryDate = DateOnly.Parse(batch.DeliveryDate),
                    batch.Quantity,
                    LRNumber     = batch.LrNumber,
                    batch.TruckNumber,
                    batch.VehicleNumber,
                    batch.MillInvoiceNo,
                    batch.Remarks,
                    CreatedBy    = createdBy,
                }, tx);

            // Increment DispatchedQty and update status when fully dispatched
            var row = await conn.QueryFirstOrDefaultAsync<(decimal OrderedQty, decimal DispatchedQty, string ProductionStatus)>(@"
                SELECT OrderedQty, DispatchedQty, ProductionStatus
                FROM procurement.MillTrackers WHERE Id=@Id AND IsDeleted=0",
                new { Id = id }, tx);

            var newDispatched  = row.DispatchedQty + batch.Quantity;
            var autoStatus     = row.ProductionStatus;
            if (newDispatched > 0 && newDispatched < row.OrderedQty)
                autoStatus = "Partial Dispatched";
            else if (newDispatched >= row.OrderedQty)
                autoStatus = "Dispatched";

            await conn.ExecuteAsync(@"
                UPDATE procurement.MillTrackers
                SET DispatchedQty=@Dispatched, ProductionStatus=@Status,
                    LastUpdate=GETUTCDATE(), LastUpdatedBy=@By,
                    UpdatedAt=GETUTCDATE(), UpdatedBy=@By
                WHERE Id=@Id AND IsDeleted=0",
                new { Id = id, Dispatched = newDispatched, Status = autoStatus, By = createdBy }, tx);

            // History entry
            await conn.ExecuteAsync(@"
                INSERT INTO procurement.MillTrackerHistory
                    (TrackerId, Action, [Status], NewQty, OldQty, Note, UpdatedBy, UpdatedAt, CreatedAt, CreatedBy)
                VALUES
                    (@TrackerId, 'BatchDispatched', @Status, @Qty, @OldQty, @Note, @By, GETUTCDATE(), GETUTCDATE(), @By)",
                new
                {
                    TrackerId = id,
                    Status    = autoStatus,
                    Qty       = newDispatched,
                    OldQty    = row.DispatchedQty,
                    Note      = batch.Remarks ?? $"Batch {batchNo} dispatched",
                    By        = createdBy,
                }, tx);

            tx.Commit();

            return new MillTrackerBatchDto
            {
                Id            = batchId,
                TrackerId     = id,
                BatchNo       = batchNo,
                DeliveryDate  = batch.DeliveryDate,
                Quantity      = batch.Quantity,
                LrNumber      = batch.LrNumber,
                TruckNumber   = batch.TruckNumber,
                VehicleNumber = batch.VehicleNumber,
                MillInvoiceNo = batch.MillInvoiceNo,
                Remarks       = batch.Remarks,
                CreatedAt     = DateTime.UtcNow,
                CreatedBy     = createdBy,
            };
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task SyncForPoUpdateAsync(int poId, PurchaseOrderListDto oldPo, PurchaseOrderListDto updatedPo, string updatedBy)
    {
        var existingTrackers = await GetByPoIdAsync(poId);

        // oldPo item id → line number
        var oldLineByItemId = oldPo.Items.ToDictionary(i => i.Id, i => i.LineNumber);
        // updatedPo line number → new item (with freshly-inserted item IDs)
        var newItemByLineNo = updatedPo.Items.ToDictionary(i => i.LineNumber);
        var coveredLineNos  = new HashSet<int>();

        var expectedDelivery = string.IsNullOrEmpty(updatedPo.ExpectedDeliveryDate)
            ? (DateOnly?)null
            : DateOnly.Parse(updatedPo.ExpectedDeliveryDate);

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            foreach (var tracker in existingTrackers)
            {
                // Resolve this tracker's old line number
                int? lineNo = tracker.PoItemId.HasValue && oldLineByItemId.TryGetValue(tracker.PoItemId.Value, out var ln)
                    ? ln : (int?)null;

                if (lineNo.HasValue && newItemByLineNo.TryGetValue(lineNo.Value, out var newItem))
                {
                    // Line still present — update tracker with fresh item data
                    coveredLineNos.Add(lineNo.Value);
                    var orderedQty = newItem.WeightKg.HasValue && newItem.WeightKg > 0
                        ? newItem.WeightKg.Value : newItem.Quantity;

                    await conn.ExecuteAsync(@"
                        UPDATE procurement.MillTrackers SET
                            POItemId         = @POItemId,
                            MillId           = @MillId,
                            MaterialId       = @MaterialId,
                            OrderedQty       = @OrderedQty,
                            Rate             = @Rate,
                            TotalAmount      = @TotalAmount,
                            ExpectedDelivery = @ExpectedDelivery,
                            LinkedSOId       = @LinkedSOId,
                            DeliveryMode     = @DeliveryMode,
                            CustomerName     = @CustomerName,
                            CustomerId       = @CustomerId,
                            LastUpdate       = GETUTCDATE(),
                            LastUpdatedBy    = @UpdatedBy,
                            UpdatedAt        = GETUTCDATE(),
                            UpdatedBy        = @UpdatedBy
                        WHERE Id=@Id AND IsDeleted=0",
                        new
                        {
                            Id               = tracker.Id,
                            POItemId         = newItem.Id,
                            MillId           = updatedPo.MillId,
                            MaterialId       = newItem.MaterialId,
                            OrderedQty       = orderedQty,
                            Rate             = newItem.Rate,
                            TotalAmount      = newItem.Amount,
                            ExpectedDelivery = expectedDelivery,
                            LinkedSOId       = updatedPo.LinkedSOId,
                            DeliveryMode     = updatedPo.DeliveryMode,
                            CustomerName     = updatedPo.DirectCustomer,
                            CustomerId       = updatedPo.DirectCustomerId,
                            UpdatedBy        = updatedBy,
                        }, tx);

                    await conn.ExecuteAsync(@"
                        INSERT INTO procurement.MillTrackerHistory
                            (TrackerId, Action, [Status], NewQty, OldQty, Note, UpdatedBy, UpdatedAt, CreatedAt, CreatedBy)
                        VALUES
                            (@TrackerId, 'POUpdated', @Status, @NewQty, @OldQty, @Note, @By, GETUTCDATE(), GETUTCDATE(), @By)",
                        new
                        {
                            TrackerId = tracker.Id,
                            Status    = tracker.ProductionStatus,
                            NewQty    = orderedQty,
                            OldQty    = tracker.OrderedQty,
                            Note      = $"PO updated — ordered qty {tracker.OrderedQty:0.##} → {orderedQty:0.##}",
                            By        = updatedBy,
                        }, tx);
                }
                else if (lineNo.HasValue)
                {
                    // Line was removed from PO — soft-delete tracker
                    await conn.ExecuteAsync(
                        "UPDATE procurement.MillTrackers SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE Id=@Id AND IsDeleted=0",
                        new { Id = tracker.Id, By = updatedBy }, tx);
                }
                else
                {
                    // No item linkage — update PO-level fields only (mill, delivery, customer)
                    await conn.ExecuteAsync(@"
                        UPDATE procurement.MillTrackers SET
                            MillId           = @MillId,
                            ExpectedDelivery = @ExpectedDelivery,
                            LinkedSOId       = @LinkedSOId,
                            DeliveryMode     = @DeliveryMode,
                            CustomerName     = @CustomerName,
                            CustomerId       = @CustomerId,
                            LastUpdate       = GETUTCDATE(),
                            LastUpdatedBy    = @UpdatedBy,
                            UpdatedAt        = GETUTCDATE(),
                            UpdatedBy        = @UpdatedBy
                        WHERE Id=@Id AND IsDeleted=0",
                        new
                        {
                            Id               = tracker.Id,
                            MillId           = updatedPo.MillId,
                            ExpectedDelivery = expectedDelivery,
                            LinkedSOId       = updatedPo.LinkedSOId,
                            DeliveryMode     = updatedPo.DeliveryMode,
                            CustomerName     = updatedPo.DirectCustomer,
                            CustomerId       = updatedPo.DirectCustomerId,
                            UpdatedBy        = updatedBy,
                        }, tx);
                }
            }

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }

        // Create trackers for brand-new lines not covered by any existing tracker
        var newLines = updatedPo.Items.Where(i => !coveredLineNos.Contains(i.LineNumber)).ToList();
        if (newLines.Count > 0)
        {
            var partialPo = new PurchaseOrderListDto
            {
                Id                   = updatedPo.Id,
                MillId               = updatedPo.MillId,
                OrderDate            = updatedPo.OrderDate,
                POType               = updatedPo.POType,
                LinkedSOId           = updatedPo.LinkedSOId,
                DeliveryMode         = updatedPo.DeliveryMode,
                ExpectedDeliveryDate = updatedPo.ExpectedDeliveryDate,
                DirectCustomer       = updatedPo.DirectCustomer,
                DirectCustomerId     = updatedPo.DirectCustomerId,
                Items                = newLines,
            };
            await CreateForPoAsync(partialPo, updatedBy);
        }
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE procurement.MillTrackers SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE Id=@Id AND IsDeleted=0",
            new { Id = id, By = deletedBy });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task AttachChildren(System.Data.IDbConnection conn, List<MillTrackerListDto> trackers)
    {
        var ids = trackers.Select(t => t.Id).ToList();

        var batches = (await conn.QueryAsync<MillTrackerBatchDto>(
            $"{BatchSelect} AND pd.TrackerId IN @Ids ORDER BY pd.TrackerId, pd.BatchNo",
            new { Ids = ids })).ToList();

        var history = (await conn.QueryAsync<MillTrackerHistoryDto>(
            $"{HistorySelect} WHERE h.TrackerId IN @Ids ORDER BY h.TrackerId, h.UpdatedAt DESC",
            new { Ids = ids })).ToList();

        var batchMap   = batches.GroupBy(b => b.TrackerId).ToDictionary(g => g.Key, g => g.ToList());
        var historyMap = history.GroupBy(h => h.TrackerId).ToDictionary(g => g.Key, g => g.ToList());

        foreach (var t in trackers)
        {
            t.Batches = batchMap.TryGetValue(t.Id, out var b) ? b : [];
            t.History = historyMap.TryGetValue(t.Id, out var h) ? h : [];
        }
    }

    private static (string, DynamicParameters) BuildWhere(MillTrackerFilterRequest f)
    {
        var parts = new List<string> { "mt.IsDeleted = 0" };
        var p     = new DynamicParameters();

        if (f.PoId.HasValue)
        {
            parts.Add("mt.POId=@PoId");
            p.Add("PoId", f.PoId.Value);
        }
        if (f.MillId.HasValue)
        {
            parts.Add("mt.MillId=@MillId");
            p.Add("MillId", f.MillId.Value);
        }
        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            parts.Add("mt.ProductionStatus=@Status");
            p.Add("Status", f.Status);
        }
        if (f.CustomerId.HasValue)
        {
            parts.Add("mt.CustomerId=@CustomerId");
            p.Add("CustomerId", f.CustomerId.Value);
        }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(mt.PONumber LIKE @Search OR mil.Name LIKE @Search OR mt.CustomerName LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.FromDate))
        {
            parts.Add("mt.PODate >= @FromDate");
            p.Add("FromDate", DateOnly.Parse(f.FromDate));
        }
        if (!string.IsNullOrWhiteSpace(f.ToDate))
        {
            parts.Add("mt.PODate <= @ToDate");
            p.Add("ToDate", DateOnly.Parse(f.ToDate));
        }

        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "mt.Id", "mt.CreatedAt", "mt.PODate", "mt.OrderedQty", "mt.ProductionStatus", "mt.ExpectedDelivery" };

    private static string SafeColumn(string? col, string def)
    {
        if (string.IsNullOrEmpty(col)) return def;
        var qualified = col.Contains('.') ? col : $"mt.{col}";
        return AllowedSort.Contains(qualified) ? qualified : def;
    }
}
