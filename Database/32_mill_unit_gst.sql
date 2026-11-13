-- ============================================================================
-- FILE : 32_mill_unit_gst.sql
-- DESC : Adds GstNo (NVARCHAR(20) NULL) to masters.MillUnits so each mill
--        unit can carry its own GST registration number (mills sometimes
--        operate multiple units across states under different registrations).
--
-- RUN  : Anytime — idempotent. Safe to re-run.
-- NOTE : Client's production DB already has this column (was added in an
--        earlier hot-patch); this migration ensures the testing DB stays
--        schema-aligned without trying to re-add it on production.
-- ============================================================================

PRINT '── Migration 32: GstNo column on masters.MillUnits ──────────';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('masters.MillUnits')
                 AND name = 'GstNo')
BEGIN
    ALTER TABLE masters.MillUnits
        ADD GstNo NVARCHAR(20) NULL;
    PRINT '  + GstNo → masters.MillUnits';
END
ELSE
BEGIN
    PRINT '  ✓ GstNo already present on masters.MillUnits — skipped';
END
GO

PRINT '── Migration 32 complete. ──────────────────────────────────';
GO
