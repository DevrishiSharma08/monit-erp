-- ============================================================
-- FILE : 17_po_items_filtered_unique.sql
-- DESC : Replace the UQ_PurchaseOrderItems unique constraint
--        (which covers all rows) with a filtered unique index
--        that only covers active (IsDeleted=0) rows.
--
--        Without this, soft-deleting PO items and re-inserting
--        the same (POId, LineNumber) on update fails with a
--        duplicate key violation.
--
-- RUN  : After 05_procurement_tables.sql
-- Safe : Idempotent — checks before every step.
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 17: PO items filtered unique index ────────────';
GO

-- ── Step 1: Drop the old unique constraint (covers all rows) ──

IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_PurchaseOrderItems'
             AND parent_object_id = OBJECT_ID('procurement.PurchaseOrderItems'))
BEGIN
    ALTER TABLE procurement.PurchaseOrderItems
        DROP CONSTRAINT UQ_PurchaseOrderItems;
    PRINT '  - Dropped UQ_PurchaseOrderItems constraint';
END
GO

-- Also drop if it was created as a unique index rather than constraint

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'UQ_PurchaseOrderItems'
             AND object_id = OBJECT_ID('procurement.PurchaseOrderItems'))
BEGIN
    DROP INDEX UQ_PurchaseOrderItems ON procurement.PurchaseOrderItems;
    PRINT '  - Dropped UQ_PurchaseOrderItems index';
END
GO

-- ── Step 2: Create filtered unique index (active rows only) ───

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_PurchaseOrderItems_Active'
                 AND object_id = OBJECT_ID('procurement.PurchaseOrderItems'))
BEGIN
    CREATE UNIQUE INDEX UQ_PurchaseOrderItems_Active
        ON procurement.PurchaseOrderItems (POId, LineNumber)
        WHERE IsDeleted = 0;
    PRINT '  + Created UQ_PurchaseOrderItems_Active (filtered: IsDeleted=0)';
END
GO

PRINT '── Migration 17 complete. ──────────────────────────────────';
GO
