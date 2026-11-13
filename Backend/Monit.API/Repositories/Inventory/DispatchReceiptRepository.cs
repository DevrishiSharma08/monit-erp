using System.Data;
using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Inventory;

public class DispatchReceiptRepository(DbConnectionFactory db) : IDispatchReceiptRepository
{
    // ── SELECT fragments ─────────────────────────────────────────────────────

    private const string HeaderSelect = @"
        SELECT
            dr.Id,
            dr.DispatchNumber,
            CONVERT(NVARCHAR(10), dr.DispatchDate, 23)             AS DispatchDate,
            dr.SourceLoadPlanId,
            tlp.PlanNumber                                          AS LoadPlanNumber,
            tlp.TruckNumber,
            tlp.TransporterName,
            tlp.Origin,
            dr.InvoiceNumber,
            CONVERT(NVARCHAR(10), dr.InvoiceDate, 23)               AS InvoiceDate,
            dr.MillChallanNumber,
            dr.LRNumber,
            dr.VehicleNumber,
            dr.ReceivedBy,
            dr.Remarks,
            dr.[Status],
            dr.CreatedAt
        FROM   inventory.DispatchReceipts       dr
        LEFT JOIN procurement.TruckLoadPlans    tlp ON tlp.Id = dr.SourceLoadPlanId";

    private const string ItemSelect = @"
        SELECT
            dri.Id,
            dri.DispatchReceiptId,
            dri.SourceTrackerId,
            dri.SourceTlpItemId,
            dri.MaterialId,
            dri.DispatchedQty,
            dri.ItemInvoiceNo,
            dri.Remarks,
            tlpi.Paper,
            tlpi.GSM                            AS Gsm,
            tlpi.[Size],
            it.Name                             AS ItemType,
            tlpi.PoNumber
        FROM   inventory.DispatchReceiptItems       dri
        LEFT JOIN procurement.TruckLoadPlanItems    tlpi ON tlpi.Id = dri.SourceTlpItemId
        LEFT JOIN masters.Materials                 m    ON m.Id    = dri.MaterialId
        LEFT JOIN masters.ItemTypes                 it   ON it.Id   = m.ItemTypeId
        WHERE  dri.IsDeleted = 0";

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<PagedResult<DispatchReceiptDto>> GetAllAsync(DispatchReceiptFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "dr.Id") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM inventory.DispatchReceipts dr WHERE {where}";
        var dataSql  = $"{HeaderSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var rows  = (await conn.QueryAsync<DispatchReceiptDto>(dataSql, param)).ToList();

        if (rows.Count > 0) await AttachItems(conn, rows);

        return new PagedResult<DispatchReceiptDto> { Items = rows, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<DispatchReceiptDto?> GetByIdAsync(int id)
    {
        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync<DispatchReceiptDto>(
            $"{HeaderSelect} WHERE dr.Id = @Id AND dr.IsDeleted = 0",
            new { Id = id });

        if (row == null) return null;
        await AttachItems(conn, [row]);
        return row;
    }

    public async Task<List<PendingTlpForDispatchDto>> GetPendingTlpsAsync()
    {
        // TLPs that have left the mill (Dispatched/Received) but don't yet have
        // an active DispatchReceipt — these need invoice info entered.
        const string headerSql = @"
            SELECT
                tlp.Id                              AS TlpId,
                tlp.PlanNumber,
                CONVERT(NVARCHAR(10), tlp.PlanDate, 23) AS PlanDate,
                tlp.TruckNumber,
                tlp.TransporterName,
                tlp.Origin,
                tlp.[Status],
                (SELECT COUNT(*) FROM procurement.TruckLoadPlanItems tlpi
                  WHERE tlpi.PlanId = tlp.Id AND tlpi.IsDeleted = 0)        AS ItemCount,
                (SELECT ISNULL(SUM(tlpi.WeightKg), 0)
                   FROM procurement.TruckLoadPlanItems tlpi
                  WHERE tlpi.PlanId = tlp.Id AND tlpi.IsDeleted = 0)        AS TotalWeightKg
            FROM   procurement.TruckLoadPlans tlp
            WHERE  tlp.IsDeleted = 0
              AND  tlp.[Status] IN ('Dispatched', 'Received')
              AND  NOT EXISTS (
                    SELECT 1 FROM inventory.DispatchReceipts dr
                    WHERE dr.SourceLoadPlanId = tlp.Id AND dr.IsDeleted = 0)
            ORDER BY tlp.PlanDate DESC, tlp.Id DESC";

        // Per-item breakdown so the Pending Plans strip can render item-wise rows.
        // No PO/SO/customer fields included — dispatch user shouldn't see those.
        const string itemSql = @"
            SELECT
                tlpi.Id      AS ItemId,
                tlpi.PlanId  AS TlpId,
                tlpi.Paper,
                tlpi.GSM     AS Gsm,
                tlpi.[Size],
                tlpi.WeightKg
            FROM   procurement.TruckLoadPlanItems tlpi
            WHERE  tlpi.IsDeleted = 0
              AND  tlpi.PlanId IN @TlpIds
            ORDER BY tlpi.PlanId, tlpi.Id";

        using var conn = db.Create();
        var headers = (await conn.QueryAsync<PendingTlpForDispatchDto>(headerSql)).ToList();
        if (headers.Count == 0) return headers;

        var ids = headers.Select(h => h.TlpId).ToList();
        var rows = await conn.QueryAsync<(int ItemId, int TlpId, string? Paper, int? Gsm, string? Size, decimal WeightKg)>(
            itemSql, new { TlpIds = ids });

        var byPlan = rows.GroupBy(r => r.TlpId)
            .ToDictionary(g => g.Key, g => g.Select(r => new PendingTlpItemDto
            {
                ItemId   = r.ItemId,
                Paper    = r.Paper,
                Gsm      = r.Gsm,
                Size     = r.Size,
                WeightKg = r.WeightKg,
            }).ToList());

        foreach (var h in headers)
            h.Items = byPlan.TryGetValue(h.TlpId, out var list) ? list : [];

        return headers;
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    public async Task<int> CreateAsync(CreateDispatchReceiptDto dto, string dispatchNumber, string createdBy)
    {
        const string insertHeader = @"
            INSERT INTO inventory.DispatchReceipts
                (DispatchNumber, DispatchDate, SourceLoadPlanId, InvoiceNumber, InvoiceDate,
                 MillChallanNumber, LRNumber, VehicleNumber, ReceivedBy, Remarks,
                 [Status], CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@DispatchNumber, @DispatchDate, @SourceLoadPlanId, @InvoiceNumber, @InvoiceDate,
                 @MillChallanNumber, @LRNumber, @VehicleNumber, @ReceivedBy, @Remarks,
                 'Pending GRN', GETUTCDATE(), @CreatedBy)";

        const string insertItem = @"
            INSERT INTO inventory.DispatchReceiptItems
                (DispatchReceiptId, SourceTrackerId, SourceTlpItemId, MaterialId,
                 DispatchedQty, ItemInvoiceNo, Remarks, CreatedAt, CreatedBy)
            VALUES
                (@DispatchReceiptId, @SourceTrackerId, @SourceTlpItemId, @MaterialId,
                 @DispatchedQty, @ItemInvoiceNo, @Remarks, GETUTCDATE(), @CreatedBy)";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            var id = await conn.ExecuteScalarAsync<int>(insertHeader, new
            {
                DispatchNumber    = dispatchNumber,
                DispatchDate      = ParseDateOnly(dto.DispatchDate),
                dto.SourceLoadPlanId,
                dto.InvoiceNumber,
                InvoiceDate       = ParseDateOnly(dto.InvoiceDate),
                dto.MillChallanNumber,
                dto.LRNumber,
                dto.VehicleNumber,
                dto.ReceivedBy,
                dto.Remarks,
                CreatedBy         = createdBy,
            }, tx);

            foreach (var it in dto.Items)
            {
                // MaterialId auto-resolve from the source tracker when the
                // caller didn't supply one. Earlier the frontend was sending
                // MaterialId = undefined for every item, leaving the column
                // NULL in every dispatch row — which broke downstream
                // material-based lookups (e.g. GRN duplicate filtering).
                var materialId = it.MaterialId;
                if (materialId == null && it.SourceTrackerId != null)
                {
                    materialId = await conn.ExecuteScalarAsync<int?>(
                        "SELECT MaterialId FROM procurement.MillTrackers WHERE Id = @Id AND IsDeleted = 0",
                        new { Id = it.SourceTrackerId.Value }, tx);
                }

                await conn.ExecuteAsync(insertItem, new
                {
                    DispatchReceiptId = id,
                    it.SourceTrackerId,
                    it.SourceTlpItemId,
                    MaterialId = materialId,
                    it.DispatchedQty,
                    it.ItemInvoiceNo,
                    it.Remarks,
                    CreatedBy         = createdBy,
                }, tx);

                // Sync the source mill tracker so MOT reflects the dispatch
                // correctly. Earlier, only the manual "Add Batch" flow on
                // MOT updated tracker.DispatchedQty — the TLP → Dispatch
                // path was silent, so trackers dispatched via TLP looked
                // untouched on MOT (Ready = 0, Dispatched = 0, Balance =
                // full ordered qty). This block increments the tracker's
                // dispatched qty and auto-rolls the status forward like
                // AddBatchAsync does. Plus, when CloseTrackerAfter is set
                // (from the Enter Dispatch popup checkbox), the tracker
                // is marked closed in the same transaction.
                if (it.SourceTrackerId is int trackerId)
                {
                    var row = await conn.QueryFirstOrDefaultAsync<(decimal Ordered, decimal Dispatched, decimal Ready, string Status)>(@"
                        SELECT OrderedQty, DispatchedQty, ISNULL(ReadyQty, 0) AS Ready, ProductionStatus
                        FROM procurement.MillTrackers
                        WHERE Id = @Id AND IsDeleted = 0",
                        new { Id = trackerId }, tx);

                    var newDispatched = row.Dispatched + it.DispatchedQty;
                    var newStatus     = row.Status;
                    if      (newDispatched >= row.Ordered)                 newStatus = "Dispatched";
                    else if (newDispatched > 0 && newDispatched < row.Ordered) newStatus = "Partial Dispatched";

                    // Ready shrinks by whatever this dispatch just consumed
                    // (floored at 0) — otherwise the grid keeps showing a
                    // stale "Ready" figure from the last manual status
                    // update even after that material has already left.
                    // Closing always forces Ready to 0 outright, since a
                    // closed tracker will never dispatch anything else
                    // (client-reported bug: MOT grid showed 45,123 kg still
                    // "Ready" on an already-closed, fully-dispatched PO).
                    var newReady = it.CloseTrackerAfter ? 0 : Math.Max(0, row.Ready - it.DispatchedQty);

                    var updateSql = @"
                        UPDATE procurement.MillTrackers
                        SET   DispatchedQty     = @Dispatched,
                              ReadyQty          = @Ready,
                              ProductionStatus  = @Status,
                              LastUpdate        = GETUTCDATE(),
                              LastUpdatedBy     = @By,
                              UpdatedAt         = GETUTCDATE(),
                              UpdatedBy         = @By"
                        + (it.CloseTrackerAfter
                            ? @",  IsClosed    = 1,
                                    ClosedAt    = GETUTCDATE(),
                                    ClosedBy    = @By,
                                    CloseReason = @CloseReason"
                            : "")
                        + " WHERE Id = @Id AND IsDeleted = 0";

                    await conn.ExecuteAsync(updateSql, new
                    {
                        Id           = trackerId,
                        Dispatched   = newDispatched,
                        Ready        = newReady,
                        Status       = newStatus,
                        By           = createdBy,
                        CloseReason  = "Closed at dispatch entry",
                    }, tx);

                    // Audit history for the qty roll-up + (optional) close.
                    await conn.ExecuteAsync(@"
                        INSERT INTO procurement.MillTrackerHistory
                            (TrackerId, Action, OldQty, NewQty, [Status], Note, UpdatedBy, UpdatedAt, CreatedAt, CreatedBy)
                        VALUES
                            (@TrackerId, @Action, @OldQty, @NewQty, @Status, @Note, @By, GETUTCDATE(), GETUTCDATE(), @By)",
                        new
                        {
                            TrackerId = trackerId,
                            Action    = it.CloseTrackerAfter ? "DispatchedAndClosed" : "Dispatched",
                            OldQty    = row.Dispatched,
                            NewQty    = newDispatched,
                            Status    = newStatus,
                            Note      = $"DR #{id} — {it.DispatchedQty} kg"
                                        + (it.CloseTrackerAfter ? " · tracker closed" : ""),
                            By        = createdBy,
                        }, tx);
                }
            }

            tx.Commit();
            return id;
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task<bool> HasGrnAsync(int dispatchReceiptId)
    {
        using var conn = db.Create();
        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM inventory.GRNs WHERE DispatchReceiptId = @Id AND IsDeleted = 0",
            new { Id = dispatchReceiptId });
        return count > 0;
    }

    public async Task UpdateAsync(int id, UpdateDispatchReceiptDto dto, string updatedBy)
    {
        const string updateHeader = @"
            UPDATE inventory.DispatchReceipts
            SET    DispatchDate      = @DispatchDate,
                   InvoiceNumber     = @InvoiceNumber,
                   InvoiceDate       = @InvoiceDate,
                   MillChallanNumber = @MillChallanNumber,
                   LRNumber          = @LRNumber,
                   VehicleNumber     = @VehicleNumber,
                   ReceivedBy        = @ReceivedBy,
                   Remarks           = @Remarks,
                   UpdatedAt         = GETUTCDATE(),
                   UpdatedBy         = @UpdatedBy
            WHERE  Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(updateHeader, new
            {
                Id                = id,
                DispatchDate      = ParseDateOnly(dto.DispatchDate),
                dto.InvoiceNumber,
                InvoiceDate       = ParseDateOnly(dto.InvoiceDate),
                dto.MillChallanNumber,
                dto.LRNumber,
                dto.VehicleNumber,
                dto.ReceivedBy,
                dto.Remarks,
                UpdatedBy         = updatedBy,
            }, tx);

            // Capture what each source tracker was credited with BEFORE we
            // wipe the old items — needed below to reconcile the tracker's
            // Dispatched/Ready qty against whatever the edit actually
            // changed (see the tracker-sync block after the insert loop).
            var oldTrackerTotals = (await conn.QueryAsync<(int TrackerId, decimal Total)>(@"
                SELECT SourceTrackerId AS TrackerId, SUM(DispatchedQty) AS Total
                FROM   inventory.DispatchReceiptItems
                WHERE  DispatchReceiptId = @Id AND IsDeleted = 0 AND SourceTrackerId IS NOT NULL
                GROUP BY SourceTrackerId",
                new { Id = id }, tx))
                .ToDictionary(r => r.TrackerId, r => r.Total);

            // Replace items: soft-delete existing, re-insert from DTO
            await conn.ExecuteAsync(
                "UPDATE inventory.DispatchReceiptItems SET IsDeleted = 1 WHERE DispatchReceiptId = @Id AND IsDeleted = 0",
                new { Id = id }, tx);

            const string insertItem = @"
                INSERT INTO inventory.DispatchReceiptItems
                    (DispatchReceiptId, SourceTrackerId, SourceTlpItemId, MaterialId,
                     DispatchedQty, ItemInvoiceNo, Remarks, CreatedAt, CreatedBy)
                VALUES
                    (@DispatchReceiptId, @SourceTrackerId, @SourceTlpItemId, @MaterialId,
                     @DispatchedQty, @ItemInvoiceNo, @Remarks, GETUTCDATE(), @CreatedBy)";

            foreach (var it in dto.Items)
            {
                // Same materialId auto-resolve as CreateAsync — see the
                // comment there for why the frontend leaves MaterialId
                // undefined and how we recover the value from the tracker.
                var materialId = it.MaterialId;
                if (materialId == null && it.SourceTrackerId != null)
                {
                    materialId = await conn.ExecuteScalarAsync<int?>(
                        "SELECT MaterialId FROM procurement.MillTrackers WHERE Id = @Id AND IsDeleted = 0",
                        new { Id = it.SourceTrackerId.Value }, tx);
                }

                await conn.ExecuteAsync(insertItem, new
                {
                    DispatchReceiptId = id,
                    it.SourceTrackerId,
                    it.SourceTlpItemId,
                    MaterialId = materialId,
                    it.DispatchedQty,
                    it.ItemInvoiceNo,
                    it.Remarks,
                    CreatedBy         = updatedBy,
                }, tx);
            }

            // Reconcile every affected tracker (old set ∪ new set) against
            // the NET change this edit made — otherwise editing a dispatch
            // quantity (or moving an item off/onto a different tracker)
            // silently leaves the Mill Tracker's Dispatched/Ready stuck at
            // the pre-edit numbers (client-reported gap, same root cause
            // class as the Ready/Dispatched sync bugs fixed earlier).
            var newTrackerTotals = dto.Items
                .Where(it => it.SourceTrackerId.HasValue)
                .GroupBy(it => it.SourceTrackerId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(it => it.DispatchedQty));

            foreach (var trackerId in oldTrackerTotals.Keys.Union(newTrackerTotals.Keys))
            {
                var oldTotal = oldTrackerTotals.GetValueOrDefault(trackerId);
                var newTotal = newTrackerTotals.GetValueOrDefault(trackerId);
                var delta    = newTotal - oldTotal;
                if (delta == 0) continue;
                await AdjustTrackerForDeltaAsync(conn, tx, trackerId, delta,
                    "DispatchEdited", $"DR #{id} edited — {delta:+0.##;-0.##} kg", updatedBy);
            }

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateStatusAsync(int id, string status, string updatedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE inventory.DispatchReceipts SET [Status] = @Status, UpdatedAt = GETUTCDATE(), UpdatedBy = @By WHERE Id = @Id AND IsDeleted = 0",
            new { Id = id, Status = status, By = updatedBy });
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Same reconciliation as UpdateAsync, simplified to a straight
            // reversal (new total = 0 for every tracker this receipt fed) —
            // deleting a dispatch means it never happened, so the source
            // tracker's Dispatched/Ready must give back whatever this
            // receipt had contributed.
            var oldTrackerTotals = (await conn.QueryAsync<(int TrackerId, decimal Total)>(@"
                SELECT SourceTrackerId AS TrackerId, SUM(DispatchedQty) AS Total
                FROM   inventory.DispatchReceiptItems
                WHERE  DispatchReceiptId = @Id AND IsDeleted = 0 AND SourceTrackerId IS NOT NULL
                GROUP BY SourceTrackerId",
                new { Id = id }, tx))
                .ToDictionary(r => r.TrackerId, r => r.Total);

            await conn.ExecuteAsync(
                "UPDATE inventory.DispatchReceipts SET IsDeleted = 1, DeletedAt = GETUTCDATE(), DeletedBy = @By WHERE Id = @Id AND IsDeleted = 0",
                new { Id = id, By = deletedBy }, tx);
            await conn.ExecuteAsync(
                "UPDATE inventory.DispatchReceiptItems SET IsDeleted = 1 WHERE DispatchReceiptId = @Id AND IsDeleted = 0",
                new { Id = id }, tx);

            foreach (var (trackerId, total) in oldTrackerTotals)
            {
                if (total == 0) continue;
                await AdjustTrackerForDeltaAsync(conn, tx, trackerId, -total,
                    "DispatchDeleted", $"DR #{id} deleted — {total:0.##} kg reversed", deletedBy);
            }

            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task AttachItems(System.Data.IDbConnection conn, List<DispatchReceiptDto> headers)
    {
        var ids = headers.Select(h => h.Id).ToList();
        var items = (await conn.QueryAsync<DispatchReceiptItemDto>(
            $"{ItemSelect} AND dri.DispatchReceiptId IN @Ids ORDER BY dri.DispatchReceiptId, dri.Id",
            new { Ids = ids })).ToList();

        var map = items.GroupBy(i => i.DispatchReceiptId).ToDictionary(g => g.Key, g => g.ToList());
        foreach (var h in headers)
            h.Items = map.TryGetValue(h.Id, out var list) ? list : [];
    }

    // Shared by UpdateAsync and SoftDeleteAsync — adjusts a source tracker's
    // Dispatched/Ready/Status by a net delta (positive = more dispatched
    // than before, negative = less/reversed). Mirrors the same invariants
    // used at create time (CreateAsync above) and at manual status updates
    // (MillTrackerRepository.UpdateStatusAsync): a closed tracker's Ready
    // always stays 0 rather than being restored, and Status is only rolled
    // back when it was this dispatch activity that set it in the first
    // place (never clobbers an unrelated manually-set status like "In
    // Production" or "Delayed").
    private sealed class TrackerDeltaRow
    {
        public decimal Ordered { get; set; }
        public decimal Dispatched { get; set; }
        public decimal Ready { get; set; }
        public bool IsClosed { get; set; }
        public string Status { get; set; } = "";
    }

    private static async Task AdjustTrackerForDeltaAsync(
        IDbConnection conn, IDbTransaction tx, int trackerId, decimal delta,
        string action, string note, string updatedBy)
    {
        if (delta == 0) return;

        var row = await conn.QueryFirstOrDefaultAsync<TrackerDeltaRow>(@"
            SELECT OrderedQty AS Ordered, DispatchedQty AS Dispatched,
                   ISNULL(ReadyQty, 0) AS Ready, ISNULL(IsClosed, 0) AS IsClosed,
                   ProductionStatus AS Status
            FROM   procurement.MillTrackers
            WHERE  Id = @Id AND IsDeleted = 0",
            new { Id = trackerId }, tx);
        if (row == null) return;   // tracker missing/deleted — nothing to reconcile

        var newDispatched = Math.Max(0, row.Dispatched + delta);
        // Closed trackers always show Ready = 0 (see MillTrackerRepository
        // .CloseAsync) — don't resurrect a "Ready" figure just because a
        // dispatch tied to it got edited/deleted.
        var newReady = row.IsClosed ? 0m : Math.Max(0, row.Ready - delta);

        var newStatus = row.Status;
        if (!row.IsClosed)
        {
            if (row.Ordered > 0 && newDispatched >= row.Ordered)
                newStatus = "Dispatched";
            else if (newDispatched > 0)
                newStatus = "Partial Dispatched";
            else if (string.Equals(row.Status, "Dispatched", StringComparison.OrdinalIgnoreCase)
                  || string.Equals(row.Status, "Partial Dispatched", StringComparison.OrdinalIgnoreCase))
                // Fully reversed — roll back to Ready only if there's
                // now something sitting ready; otherwise leave the status
                // alone rather than guessing at an earlier production stage.
                newStatus = newReady > 0 ? "Ready" : row.Status;
        }

        await conn.ExecuteAsync(@"
            UPDATE procurement.MillTrackers
            SET    DispatchedQty    = @Dispatched,
                   ReadyQty         = @Ready,
                   ProductionStatus = @Status,
                   LastUpdate       = GETUTCDATE(),
                   LastUpdatedBy    = @By,
                   UpdatedAt        = GETUTCDATE(),
                   UpdatedBy        = @By
            WHERE  Id = @Id AND IsDeleted = 0",
            new { Id = trackerId, Dispatched = newDispatched, Ready = newReady, Status = newStatus, By = updatedBy }, tx);

        await conn.ExecuteAsync(@"
            INSERT INTO procurement.MillTrackerHistory
                (TrackerId, Action, OldStatus, [Status], OldQty, NewQty, Note, UpdatedBy, UpdatedAt, CreatedAt, CreatedBy)
            VALUES
                (@TrackerId, @Action, @OldStatus, @NewStatus, @OldQty, @NewQty, @Note, @By, GETUTCDATE(), GETUTCDATE(), @By)",
            new
            {
                TrackerId = trackerId,
                Action    = action,
                OldStatus = row.Status,
                NewStatus = newStatus,
                OldQty    = row.Dispatched,
                NewQty    = newDispatched,
                Note      = note,
                By        = updatedBy,
            }, tx);
    }

    private static (string, DynamicParameters) BuildWhere(DispatchReceiptFilterRequest f)
    {
        var parts = new List<string> { "dr.IsDeleted = 0" };
        var p     = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            parts.Add("dr.[Status] = @Status");
            p.Add("Status", f.Status);
        }
        if (!string.IsNullOrWhiteSpace(f.InvoiceNumber))
        {
            parts.Add("dr.InvoiceNumber LIKE @Invoice");
            p.Add("Invoice", $"%{f.InvoiceNumber.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(dr.DispatchNumber LIKE @Search OR dr.InvoiceNumber LIKE @Search OR dr.VehicleNumber LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.FromDate))
        {
            parts.Add("dr.DispatchDate >= @FromDate");
            p.Add("FromDate", DateOnly.Parse(f.FromDate));
        }
        if (!string.IsNullOrWhiteSpace(f.ToDate))
        {
            parts.Add("dr.DispatchDate <= @ToDate");
            p.Add("ToDate", DateOnly.Parse(f.ToDate));
        }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "dr.Id", "dr.DispatchDate", "dr.CreatedAt", "dr.[Status]" };

    private static string SafeColumn(string? col, string def)
    {
        if (string.IsNullOrEmpty(col)) return def;
        var qualified = col.Contains('.') ? col : $"dr.{col}";
        return AllowedSort.Contains(qualified) ? qualified : def;
    }

    private static DateOnly? ParseDateOnly(string? val)
        => string.IsNullOrWhiteSpace(val) ? null : DateOnly.Parse(val);
}
