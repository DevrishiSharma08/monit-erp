-- ============================================================
-- FILE : 39_mot_closed_ready_qty_fix.sql
-- DESC : One-time data fix + forward-looking behavior fix for a client-
--        reported bug: Mill Tracker's ReadyQty was never decremented when
--        a dispatch consumed it, and never zeroed when a tracker was
--        closed (via 3-dot "Close Tracker" or the dispatch-entry "Close?"
--        checkbox). Trackers already fully dispatched + closed kept
--        showing a large stale "Ready" figure on the MOT grid, misleading
--        users into planning another truck load against material that
--        will never actually be dispatched.
--
--        The code-side fix (MillTrackerRepository.CloseAsync,
--        DispatchReceiptRepository.CreateAsync) now zeroes/decrements
--        ReadyQty going forward. This script retroactively fixes trackers
--        that are ALREADY closed with a stale nonzero ReadyQty — closed
--        always means Ready should be 0, so this is unambiguous and safe.
--        It deliberately does NOT touch still-open (not-closed) trackers'
--        ReadyQty, since those may have been kept in sync manually via
--        the Update Status modal and recomputing them here could
--        conflict with real-world QC-hold/partial-batch nuances the
--        system doesn't otherwise track.
-- RUN  : Idempotent — safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================

UPDATE procurement.MillTrackers
SET    ReadyQty  = 0,
       UpdatedAt = GETUTCDATE(),
       UpdatedBy = 'system-migration-39'
WHERE  IsDeleted = 0
  AND  ISNULL(IsClosed, 0) = 1
  AND  ISNULL(ReadyQty, 0) <> 0;
GO
