-- ============================================================================
-- FILE : 43_mot_dispatched_ready_reconciliation.sql
-- DESC : One-time, conservative data reconciliation for Mill Tracker
--        quantities — companion to the code fix in
--        DispatchReceiptRepository.CreateAsync (which now correctly syncs
--        DispatchedQty/ReadyQty on every NEW dispatch). That fix only
--        applies going forward; trackers that were dispatched via the
--        TLP → Dispatch flow BEFORE the fix existed are still sitting with
--        whatever DispatchedQty/ReadyQty they had at the time (client-
--        reported: some trackers show correct Ready/Dispatched/Balance,
--        others don't — exactly what you'd see with a mix of pre-fix and
--        post-fix dispatch history).
--
--        This script does NOT touch ProductionStatus (deliberately — a
--        status like "Delayed" or a manually-picked value should not be
--        silently overwritten by a data-repair script; only the numbers
--        are corrected):
--
--        Step 1 — DispatchedQty ground truth:
--          Recompute every tracker's DispatchedQty as the SUM of its actual
--          (non-deleted) inventory.DispatchReceiptItems.DispatchedQty. This
--          is the one number that can be derived with certainty from real
--          dispatch history, independent of anything the UI has shown.
--
--        Step 2 — ReadyQty sanity clamp:
--          A tracker can never legitimately have more "Ready" (produced,
--          not yet dispatched) than its remaining Balance (Ordered -
--          Dispatched) — if Ready is currently larger than that (the
--          telltale sign of a stale pre-fix value), clamp it down to
--          Balance. Trackers where Ready was already <= Balance are left
--          untouched (their Ready may be a smaller, legitimately accurate
--          in-production figure — this script only removes impossible
--          values, never guesses at a "more correct" smaller one).
--
-- RUN  : Idempotent — safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================================

PRINT '── Migration 43: MOT Dispatched/Ready reconciliation ──────';
GO

-- Step 1: DispatchedQty ground truth from actual dispatch history.
UPDATE mt
SET    DispatchedQty = ISNULL(agg.TotalDispatched, 0),
       UpdatedAt     = GETUTCDATE(),
       UpdatedBy     = 'system-migration-43'
FROM   procurement.MillTrackers mt
OUTER APPLY (
    SELECT SUM(dri.DispatchedQty) AS TotalDispatched
    FROM   inventory.DispatchReceiptItems dri
    JOIN   inventory.DispatchReceipts     dr ON dr.Id = dri.DispatchReceiptId AND dr.IsDeleted = 0
    WHERE  dri.SourceTrackerId = mt.Id AND dri.IsDeleted = 0
) agg
WHERE  mt.IsDeleted = 0
  AND  mt.DispatchedQty <> ISNULL(agg.TotalDispatched, 0);
GO

-- Step 2: ReadyQty can never exceed the remaining Balance (Ordered - Dispatched).
UPDATE procurement.MillTrackers
SET    ReadyQty  = CASE WHEN (OrderedQty - DispatchedQty) < 0 THEN 0 ELSE (OrderedQty - DispatchedQty) END,
       UpdatedAt = GETUTCDATE(),
       UpdatedBy = 'system-migration-43'
WHERE  IsDeleted = 0
  AND  ReadyQty > (OrderedQty - DispatchedQty);
GO

PRINT '── Migration 43 complete. ─────────────────────────────────';
GO
