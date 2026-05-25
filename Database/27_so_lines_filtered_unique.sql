-- ============================================================
-- FILE : 27_so_lines_filtered_unique.sql
-- DESC : Convert UQ_SalesOrderLines (SOId, LineNumber) into a
--        FILTERED unique index that ignores soft-deleted rows.
--
--        Required so SO update can SOFT-delete existing lines
--        (instead of HARD-delete) — hard-delete fails when PO
--        items reference SO lines via FK_PurchaseOrderItems_SOLine.
-- RUN  : After 04_sales_tables.sql
-- Idempotent — safe to re-run.
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 27: SO Lines filtered unique ───────────────────';
GO

-- 1. Drop the unfiltered unique constraint (if it still exists)
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_SalesOrderLines'
             AND parent_object_id = OBJECT_ID('sales.SalesOrderLines'))
BEGIN
    ALTER TABLE sales.SalesOrderLines DROP CONSTRAINT UQ_SalesOrderLines;
    PRINT '  - UQ_SalesOrderLines dropped';
END
GO

-- 2. Create a filtered unique index covering only live rows
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UX_SalesOrderLines_Live'
                 AND object_id = OBJECT_ID('sales.SalesOrderLines'))
BEGIN
    CREATE UNIQUE INDEX UX_SalesOrderLines_Live
        ON sales.SalesOrderLines (SOId, LineNumber)
        WHERE IsDeleted = 0;
    PRINT '  + UX_SalesOrderLines_Live (filtered unique, IsDeleted = 0)';
END
GO

PRINT '── Migration 27 complete. ──────────────────────────────────';
GO
