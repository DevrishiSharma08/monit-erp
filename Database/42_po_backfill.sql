-- ============================================================================
-- FILE : 42_po_backfill.sql
-- DESC : Backfill / backdated PO support — exact mirror of migration 36
--        (SO backfill). Adds an IsBackfilled flag on procurement.PurchaseOrders
--        so the user can enter old (pre-system) POs from their manual
--        register without disturbing the auto-generated PO number.
--
--        Behaviour when IsBackfilled = 1:
--          • The frontend supplies a custom PONumber (typed by the user in
--            their original format, e.g. "PO/2024/05/038").
--          • PurchaseOrderRepository.CreateAsync's MAX(PONumber)+1 auto-
--            number query is skipped entirely for this row — since that
--            query only scans PONumber LIKE 'PO-<year>-%', a backfilled
--            number in the user's own historical format never interferes
--            with future auto-numbering anyway.
--          • OrderDate is whatever the user picks (the original historical
--            date, not today).
--          • Status defaults the same way; downstream chain (Mill Tracker /
--            TLP / Dispatch / GRN) treats the row identically — backfilled
--            POs are real POs, just historically dated.
--
--        Behaviour when IsBackfilled = 0 (default — every existing row):
--          • Untouched. Auto-generated number + today's OrderDate as before.
--
-- RUN  : Anytime — idempotent. Safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================================

PRINT '── Migration 42: PO Backfill support ──────────────────────';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('procurement.PurchaseOrders')
                 AND name = 'IsBackfilled')
BEGIN
    ALTER TABLE procurement.PurchaseOrders
        ADD IsBackfilled BIT NOT NULL
            CONSTRAINT DF_PurchaseOrders_IsBackfilled DEFAULT 0;
    PRINT '  + IsBackfilled → procurement.PurchaseOrders';
END
ELSE
BEGIN
    PRINT '  ✓ IsBackfilled already present — skipped';
END
GO

PRINT '── Migration 42 complete. ─────────────────────────────────';
GO
