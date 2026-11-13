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
            -- Brand = the quality's Alias (e.g. Eco Polar) -- NOT ssg.Name
            -- (that is the quality name itself, e.g. Maplitho). Surfaced
            -- separately so MOT grid + Excel template can show it in its
            -- own column instead of being buried inside the composite item
            -- code (client UAT: clerks want to filter by brand directly).
            -- Matches the same Alias-as-brand convention used by
            -- PurchaseOrderRepository/SalesOrderRepository/MaterialRepository
            -- (client-reported 2026-11-06: this column was showing the
            -- quality name instead of the actual brand).
            ssg.Alias                                                                    AS BrandName,
            poi.Remark                                                                   AS ItemRemark,
            ISNULL(poi.GSM,         mat.GSM)                                            AS Gsm,
            poi.Size                                                                    AS Size,
            mt.OrderedQty,
            mt.ReadyQty,
            mt.DispatchedQty,
            ISNULL(mt.Rate,        ISNULL(poi.Rate,   0))                              AS Rate,
            poi.Discount                                                                AS Discount,
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
            -- PO Customer fallback: stored override -> PO direct customer
            -- -> linked SO customer. Last fallback handles PO-against-SO
            -- rows where DirectCustomerId was never set: linked SO knows
            -- the real customer, so MOT shows it instead of Stock PO.
            ISNULL(mt.CustomerName, ISNULL(dc.Name, soc.Name))                         AS CustomerName,
            ISNULL(mt.CustomerId,   ISNULL(po.DirectCustomerId, so.CustomerId))        AS CustomerId,
            so.SONumber                                                                AS SoNumber,
            CONVERT(NVARCHAR(10), so.RequiredDeliveryDate, 23)                        AS SoDeliveryDate,
            po.DirectCustomerId                                                        AS SoCustomerId,
            soc.Name                                                                   AS SoCustomerName,
            mt.Remarks,
            po.MillSONumber,
            po.DirectDeliveryAddress,
            -- The picked unit's own address only. Falling back to a
            -- different unit under this mill when a unit WAS picked
            -- (po.MillUnitId IS NOT NULL) used to silently substitute a
            -- different unit's real street address (same bug class found in
            -- PurchaseOrderRepository: a tracker under ITC Bhadrachalam
            -- showed OMNI unit's address because Bhadrachalam's own Address
            -- field was blank). The mill-wide fallback now only fires for
            -- legacy rows that never had a unit picked at all.
            CASE WHEN po.MillUnitId IS NOT NULL THEN muu.Address ELSE
                (SELECT TOP 1 mu.Address
                 FROM   masters.MillUnits mu
                 WHERE  mu.MillId = mt.MillId AND mu.IsDeleted = 0
                 ORDER  BY mu.IsDefault DESC, mu.Id)
            END                                                                AS MillAddress,
            po.MillUnitId,
            muu.UnitName                                                        AS MillUnitName,
            -- Close-tracker flow — short-delivery final acceptance. Closed
            -- rows drop out of the default MOT grid via the Closed filter.
            ISNULL(mt.IsClosed, 0)                                              AS IsClosed,
            CONVERT(NVARCHAR(24), mt.ClosedAt, 126)                             AS ClosedAt,
            mt.ClosedBy,
            mt.CloseReason,
            mt.CreatedAt
        FROM  procurement.MillTrackers           mt
        JOIN  masters.Mills                      mil ON mil.Id  = mt.MillId
        LEFT JOIN masters.Materials              mat ON mat.Id  = mt.MaterialId
        LEFT JOIN masters.StockSubGroups         ssg ON ssg.Id  = mat.QualityId AND ssg.IsDeleted = 0
        LEFT JOIN procurement.PurchaseOrders     po  ON po.Id   = mt.POId  AND po.IsDeleted = 0
        LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id  = mt.POItemId
        LEFT JOIN masters.Customers              dc  ON dc.Id   = po.DirectCustomerId
        LEFT JOIN sales.SalesOrders              so  ON so.Id   = mt.LinkedSOId
        LEFT JOIN masters.Customers              soc ON soc.Id  = so.CustomerId
        LEFT JOIN masters.MillUnits              muu ON muu.Id  = po.MillUnitId";

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

        // Must join masters.Mills here too — the search filter in BuildWhere
        // references mil.Name, which otherwise doesn't exist in this bare
        // count query ("multi-part identifier 'mil.Name' could not be
        // bound", breaking the whole endpoint whenever ?search= is used).
        var countSql = $"SELECT COUNT(*) FROM procurement.MillTrackers mt JOIN masters.Mills mil ON mil.Id = mt.MillId WHERE {where}";
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
            // Idempotent: skip items that already have a (non-deleted) tracker row.
            // Lets us safely call this on Approve even if older flow already created some.
            var existingItemIds = (await conn.QueryAsync<int>(
                "SELECT POItemId FROM procurement.MillTrackers WHERE POId=@POId AND POItemId IS NOT NULL AND IsDeleted=0",
                new { POId = po.Id }, tx)).ToHashSet();

            foreach (var item in po.Items)
            {
                if (item.MaterialId <= 0) continue; // FK requires valid material
                if (existingItemIds.Contains(item.Id)) continue; // already tracked
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
            // Read old status + quantities for history and for the terminal-
            // status invariants below. BalanceQty is never stored — it's
            // always computed as OrderedQty - DispatchedQty at read time
            // (see TrackerSelect), so fixing DispatchedQty here is enough
            // to fix Balance everywhere it's displayed too.
            var row = await conn.QuerySingleAsync<(string Status, decimal Ready, decimal Ordered, decimal Dispatched)>(
                "SELECT ProductionStatus AS Status, ReadyQty AS Ready, OrderedQty AS Ordered, DispatchedQty AS Dispatched FROM procurement.MillTrackers WHERE Id=@Id AND IsDeleted=0",
                new { Id = id }, tx);
            var oldStatus = row.Status;
            var oldReady  = row.Ready;

            // "Dispatched" / "Partial Dispatched" must NEVER be set manually
            // here (this method is shared by the Update Status modal, the
            // legacy PO-number bulk import, AND the Excel bulk import — ALL
            // manual paths). They may ONLY be derived from real Dispatch
            // Receipts, created via the Dispatch page's "Enter Dispatch"
            // flow (see DispatchReceiptRepository.CreateAsync, which sets
            // ProductionStatus + DispatchedQty directly via its own SQL, not
            // through this method). Client-reported bug: a user manually
            // marked a tracker "Dispatched" (writing truck details in the
            // Remarks note instead of using Enter Dispatch) — an earlier
            // version of this method auto-filled DispatchedQty = OrderedQty
            // as a phantom value for that. When the REAL dispatch entry was
            // made afterward for the same truck, its quantity added on TOP
            // of that phantom figure, silently doubling the recorded
            // dispatch (a real 20,069 kg dispatch showed as 40,069 kg).
            // This is the exact same dual-entry-point problem the client
            // already rejected once for Mill Tracker's old "Add Batch"
            // flow — Dispatch Receipts must stay the single source of
            // truth for dispatched quantity, so we block the manual path
            // outright instead of trying to reconcile two sources.
            // Only block an actual TRANSITION into Dispatched (old status
            // wasn't already Dispatched/Partial Dispatched). If the tracker
            // is already sitting at Dispatched — e.g. DeriveStatus simply
            // re-sending the existing status while the user only edited
            // Remarks/ExpectedDelivery via Excel bulk-import — this must
            // pass through untouched, otherwise every edit to an already-
            // dispatched row throws and silently fails to save (found via
            // live bug report: PO-17/PO-18 rows already Dispatched, Excel
            // edits weren't persisting at all).
            var wasAlreadyDispatched = string.Equals(oldStatus, "Dispatched", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(oldStatus, "Partial Dispatched", StringComparison.OrdinalIgnoreCase);
            if (!wasAlreadyDispatched
             && (string.Equals(dto.Status, "Dispatched", StringComparison.OrdinalIgnoreCase)
              || string.Equals(dto.Status, "Partial Dispatched", StringComparison.OrdinalIgnoreCase)))
            {
                throw new Common.Middleware.ConflictException(
                    "Dispatched status is set automatically from actual dispatch entries — please use \"Enter Dispatch\" on the Dispatch page instead of setting it here.");
            }

            // Cancelled means nothing further will ever leave the mill
            // against this tracker — force Ready to 0 regardless of what
            // was submitted (Excel re-uploads pre-fill the Ready cell with
            // the current value, so leaving it untouched would silently
            // resubmit a stale nonzero Ready next to a terminal status).
            // Deliberately does NOT touch DispatchedQty: Cancelled means
            // "accept whatever shipped, write off the rest," same
            // semantics as the existing Close Tracker feature.
            var isTerminal     = string.Equals(dto.Status, "Cancelled", StringComparison.OrdinalIgnoreCase);
            var effectiveReady = isTerminal ? 0m : dto.ReadyQty;

            var updateParts = new List<string>
            {
                "ProductionStatus=@Status",
                "LastUpdate=GETUTCDATE()",
                "LastUpdatedBy=@UpdatedBy",
                "UpdatedAt=GETUTCDATE()",
                "UpdatedBy=@UpdatedBy",
            };
            if (dto.Progress.HasValue)                    updateParts.Add("ProductionProgress=@Progress");
            if (effectiveReady.HasValue)                  updateParts.Add("ReadyQty=@ReadyQty");
            if (!string.IsNullOrEmpty(dto.ExpectedDelivery)) updateParts.Add("ExpectedDelivery=@ExpectedDelivery");
            // Note also stamps onto mt.Remarks so the latest remark is
            // visible in the MOT grid + Excel template (the history table
            // keeps the full audit chain — Remarks is the "latest only"
            // surface the client UAT asked for).
            if (!string.IsNullOrEmpty(dto.Note))          updateParts.Add("Remarks=@Note");

            var expDelivery = string.IsNullOrEmpty(dto.ExpectedDelivery) ? (DateOnly?)null : DateOnly.Parse(dto.ExpectedDelivery);
            await conn.ExecuteAsync(
                $"UPDATE procurement.MillTrackers SET {string.Join(", ", updateParts)} WHERE Id=@Id AND IsDeleted=0",
                new { Id = id, dto.Status, UpdatedBy = updatedBy, dto.Progress, ReadyQty = effectiveReady, ExpectedDelivery = expDelivery, dto.Note }, tx);

            var historyNote = dto.Note;

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
                    NewQty     = effectiveReady ?? oldReady,
                    Note       = historyNote,
                    UpdatedBy  = updatedBy,
                }, tx);

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    // Close tracker — mark as short-delivery finalized. Balance qty is
    // accepted as-is (no more expected from mill). One-way action per
    // client spec: reopen not supported. Audit fields let us surface who
    // closed the tracker + optional reason on the detail view + history.
    public async Task CloseAsync(int id, string? reason, string closedBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Guard: already closed → noop (idempotent, safe re-clicks)
            var alreadyClosed = await conn.ExecuteScalarAsync<bool>(
                "SELECT ISNULL(IsClosed, 0) FROM procurement.MillTrackers WHERE Id=@Id AND IsDeleted=0",
                new { Id = id }, tx);
            if (alreadyClosed) { tx.Commit(); return; }

            // ReadyQty forced to 0 on close — a closed tracker will never
            // dispatch anything else, so leaving a stale nonzero Ready
            // figure on screen misleads the user into planning another
            // truck load against it (client-reported bug).
            await conn.ExecuteAsync(@"
                UPDATE procurement.MillTrackers
                SET    IsClosed    = 1,
                       ClosedAt    = GETUTCDATE(),
                       ClosedBy    = @By,
                       CloseReason = @Reason,
                       ReadyQty    = 0,
                       UpdatedAt   = GETUTCDATE(),
                       UpdatedBy   = @By
                WHERE  Id = @Id AND IsDeleted = 0",
                new { Id = id, By = closedBy, Reason = reason }, tx);

            // Snapshot current status so we can carry it into the history
            // row (Status column is NOT NULL on MillTrackerHistory — a bare
            // insert without it aborts the whole tx).
            var currentStatus = await conn.ExecuteScalarAsync<string>(
                "SELECT ProductionStatus FROM procurement.MillTrackers WHERE Id=@Id AND IsDeleted=0",
                new { Id = id }, tx) ?? "Closed";

            // History entry — surfaces the close event in the tracker's
            // audit trail alongside status/qty changes.
            await conn.ExecuteAsync(@"
                INSERT INTO procurement.MillTrackerHistory
                    (TrackerId, Action, [Status], Note, UpdatedBy, UpdatedAt, CreatedAt, CreatedBy)
                VALUES
                    (@Id, 'TrackerClosed', @Status, @Reason, @By, GETUTCDATE(), GETUTCDATE(), @By)",
                new { Id = id, Status = currentStatus, By = closedBy, Reason = reason ?? "Closed at partial dispatch" }, tx);

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

    public async Task<Dictionary<int, string>> GetBlockingStatusesForPoItemsAsync(IEnumerable<int> poItemIds)
    {
        var ids = poItemIds.Distinct().ToList();
        if (ids.Count == 0) return new();

        using var conn = db.Create();
        var rows = await conn.QueryAsync<(int POItemId, string ProductionStatus)>(@"
            SELECT POItemId, ProductionStatus
            FROM   procurement.MillTrackers
            WHERE  POItemId IN @Ids AND IsDeleted = 0
              AND  ProductionStatus <> 'Order Placed'",
            new { Ids = ids });
        return rows.ToDictionary(r => r.POItemId, r => r.ProductionStatus);
    }

    public async Task<Dictionary<int, string>> GetBlockingStatusesForSoLinesAsync(IEnumerable<int> soLineIds)
    {
        var ids = soLineIds.Distinct().ToList();
        if (ids.Count == 0) return new();

        using var conn = db.Create();
        var rows = await conn.QueryAsync<(int SoLineId, string ProductionStatus)>(@"
            SELECT poi.LinkedSOLineId AS SoLineId, mt.ProductionStatus
            FROM   procurement.PurchaseOrderItems poi
            JOIN   procurement.MillTrackers       mt ON mt.POItemId = poi.Id AND mt.IsDeleted = 0
            WHERE  poi.LinkedSOLineId IN @Ids AND poi.IsDeleted = 0
              AND  mt.ProductionStatus <> 'Order Placed'",
            new { Ids = ids });
        return rows.ToDictionary(r => r.SoLineId, r => r.ProductionStatus);
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
        // Close filter — default (null / "active") shows only active trackers.
        // "closed" shows only closed ones. "all" shows everything.
        var closed = (f.Closed ?? "active").Trim().ToLowerInvariant();
        if (closed == "closed")
            parts.Add("ISNULL(mt.IsClosed, 0) = 1");
        else if (closed != "all")
            parts.Add("ISNULL(mt.IsClosed, 0) = 0");
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
