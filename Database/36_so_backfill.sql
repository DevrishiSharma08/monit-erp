-- ============================================================================
-- FILE : 36_so_backfill.sql
-- DESC : Backfill / backdated SO support. Adds an IsBackfilled flag on
--        sales.SalesOrders so the user can enter old (pre-system) SOs from
--        their manual register without disturbing the auto-generated SO
--        number sequence used for fresh orders.
--
--        Behaviour when IsBackfilled = 1:
--          • The frontend supplies a custom SONumber (typed by the user in
--            their original format, e.g. "SO/2024/05/038").
--          • The system.NumberSequences counter is NOT incremented, so the
--            next NEW (non-backfilled) SO keeps flowing from the same point.
--          • OrderDate is whatever the user picks (the original historical
--            date, not today).
--          • Status defaults the same way; downstream chain (PO / GRN / DC)
--            treats the row identically — backfilled SOs are real SOs, just
--            historically dated.
--
--        Behaviour when IsBackfilled = 0 (default — every existing row):
--          • Untouched. Auto-generated number + today's OrderDate as before.
--
-- RUN  : Anytime — idempotent. Safe to re-run.
-- ============================================================================

PRINT '── Migration 36: SO Backfill support ──────────────────────';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('sales.SalesOrders')
                 AND name = 'IsBackfilled')
BEGIN
    ALTER TABLE sales.SalesOrders
        ADD IsBackfilled BIT NOT NULL
            CONSTRAINT DF_SalesOrders_IsBackfilled DEFAULT 0;
    PRINT '  + IsBackfilled → sales.SalesOrders';
END
ELSE
BEGIN
    PRINT '  ✓ IsBackfilled already present — skipped';
END
GO

PRINT '── Migration 36 complete. ─────────────────────────────────';
GO
