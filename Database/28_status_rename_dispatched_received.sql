-- ============================================================
-- FILE : 28_status_rename_dispatched_received.sql
-- DESC : System-wide status terminology unification.
--          - 'In Transit'  →  'Dispatched'
--          - 'Delivered'   →  'Received'
--
--        Applies to TruckLoadPlans (and related code paths that
--        read its Status). MillTrackers, PO, GRN already use the
--        target vocabulary.
-- RUN  : Anytime after 16_truck_load_plan.sql / 26_tlp_loads.sql
-- Idempotent — safe to re-run.
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 28: Status terminology rename ──────────────────';
GO

-- 1. TruckLoadPlans: 'In Transit' → 'Dispatched'
UPDATE procurement.TruckLoadPlans
SET    Status = 'Dispatched'
WHERE  Status = 'In Transit';
PRINT CONCAT('  • TruckLoadPlans  ''In Transit''  → ''Dispatched''   rows=', @@ROWCOUNT);

-- 2. TruckLoadPlans: 'Delivered' → 'Received'
UPDATE procurement.TruckLoadPlans
SET    Status = 'Received'
WHERE  Status = 'Delivered';
PRINT CONCAT('  • TruckLoadPlans  ''Delivered''   → ''Received''     rows=', @@ROWCOUNT);

PRINT '── Migration 28 complete. ──────────────────────────────────';
GO
