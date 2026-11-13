-- ─── 37_mill_tracker_close.sql ────────────────────────────────────────────
-- Add "close tracker" columns to procurement.MillTrackers so warehouse can
-- mark short-delivered orders as finalised (no more expected from the mill)
-- without waiting for the balance qty. Closed trackers drop out of the
-- default MOT grid view and only appear when the user toggles the
-- "Closed" radio — keeping the active-work grid lean.
--
-- Fields:
--   IsClosed      bit         — 1 = tracker closed / no more from mill
--   ClosedAt      datetime2   — when it was closed
--   ClosedBy      nvarchar    — user who closed (audit)
--   CloseReason   nvarchar    — optional free-text reason
--
-- Idempotent — safe to re-run. Backfills existing rows to IsClosed = 0.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('procurement.MillTrackers')
      AND name      = 'IsClosed'
)
BEGIN
    ALTER TABLE procurement.MillTrackers
        ADD IsClosed BIT NOT NULL CONSTRAINT DF_MillTrackers_IsClosed DEFAULT (0);
    PRINT 'Added IsClosed to procurement.MillTrackers';
END
ELSE
    PRINT 'IsClosed already exists on procurement.MillTrackers';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('procurement.MillTrackers')
      AND name      = 'ClosedAt'
)
BEGIN
    ALTER TABLE procurement.MillTrackers ADD ClosedAt DATETIME2 NULL;
    PRINT 'Added ClosedAt to procurement.MillTrackers';
END
ELSE
    PRINT 'ClosedAt already exists on procurement.MillTrackers';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('procurement.MillTrackers')
      AND name      = 'ClosedBy'
)
BEGIN
    ALTER TABLE procurement.MillTrackers ADD ClosedBy NVARCHAR(200) NULL;
    PRINT 'Added ClosedBy to procurement.MillTrackers';
END
ELSE
    PRINT 'ClosedBy already exists on procurement.MillTrackers';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('procurement.MillTrackers')
      AND name      = 'CloseReason'
)
BEGIN
    ALTER TABLE procurement.MillTrackers ADD CloseReason NVARCHAR(500) NULL;
    PRINT 'Added CloseReason to procurement.MillTrackers';
END
ELSE
    PRINT 'CloseReason already exists on procurement.MillTrackers';

-- Index on IsClosed for fast Active/Closed filtering
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('procurement.MillTrackers')
      AND name      = 'IX_MillTrackers_IsClosed'
)
BEGIN
    CREATE INDEX IX_MillTrackers_IsClosed
        ON procurement.MillTrackers (IsClosed) WHERE IsDeleted = 0;
    PRINT 'Created IX_MillTrackers_IsClosed';
END
ELSE
    PRINT 'IX_MillTrackers_IsClosed already exists';

PRINT 'Migration 37_mill_tracker_close.sql complete.';
