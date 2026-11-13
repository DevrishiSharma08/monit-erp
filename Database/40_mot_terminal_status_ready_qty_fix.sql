-- ============================================================
-- FILE : 40_mot_terminal_status_ready_qty_fix.sql
-- DESC : One-time data fix + forward-looking behavior fix for a second
--        client-reported variant of the "stale Ready qty" bug (see also
--        migration 39, which covered the IsClosed case).
--
--        Root cause: ProductionStatus can be flipped to a terminal value
--        ('Dispatched' / 'Cancelled') two ways — the "Update Status" modal,
--        or the Excel bulk-import flow — both funnel through
--        MillTrackerRepository.UpdateStatusAsync. Neither path forced
--        ReadyQty to 0 when the status became terminal. This was
--        especially confusing via Excel: the export PRE-FILLS the Ready
--        cell with the tracker's CURRENT ready qty, so a user who only
--        edits the Status column (to record that the mill said "this is
--        now fully dispatched") unknowingly re-submits the OLD Ready value
--        unchanged on re-upload — the grid then shows e.g. Status =
--        "Dispatched" sitting right next to a stale nonzero "Ready" figure.
--
--        Code-side fix: MillTrackerRepository.UpdateStatusAsync now forces
--        ReadyQty = 0 whenever the submitted Status is 'Dispatched' or
--        'Cancelled', regardless of what ReadyQty value came in. This
--        script retroactively fixes trackers ALREADY sitting in that
--        terminal-status-with-nonzero-Ready state.
-- RUN  : Idempotent — safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================

UPDATE procurement.MillTrackers
SET    ReadyQty  = 0,
       UpdatedAt = GETUTCDATE(),
       UpdatedBy = 'system-migration-40'
WHERE  IsDeleted = 0
  AND  ProductionStatus IN ('Dispatched', 'Cancelled')
  AND  ISNULL(ReadyQty, 0) <> 0;
GO
