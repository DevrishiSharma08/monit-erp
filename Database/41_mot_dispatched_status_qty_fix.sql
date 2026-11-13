-- ============================================================
-- FILE : 41_mot_dispatched_status_qty_fix.sql
-- DESC : One-time data fix companion to migration 40. That migration
--        zeroed ReadyQty on trackers already sitting at a terminal status
--        with stale Ready — but left DispatchedQty/BalanceQty untouched.
--        Client-reported: a tracker showing Status = 'Dispatched' should
--        mean fully complete (Balance = 0), but DispatchedQty could still
--        be short of OrderedQty when Status was flipped manually (Update
--        Status modal / Excel bulk-import) without a matching Dispatch
--        Receipt entry for the remainder.
--
--        Code-side fix: MillTrackerRepository.UpdateStatusAsync now tops
--        DispatchedQty up to OrderedQty (never down — Math.Max) whenever
--        the submitted Status is 'Dispatched'. This script retroactively
--        applies the same top-up to trackers already in that state.
--        BalanceQty is never stored (always OrderedQty - DispatchedQty at
--        read time), so no separate Balance fix is needed.
--
--        Deliberately does NOT touch 'Cancelled' trackers — Cancelled
--        means "accept whatever shipped, write off the rest," matching
--        the existing Close Tracker semantics (short delivery is expected
--        and correct there, not a bug).
-- RUN  : Idempotent — safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================

UPDATE procurement.MillTrackers
SET    DispatchedQty = OrderedQty,
       UpdatedAt     = GETUTCDATE(),
       UpdatedBy     = 'system-migration-41'
WHERE  IsDeleted = 0
  AND  ProductionStatus = 'Dispatched'
  AND  DispatchedQty < OrderedQty;
GO
