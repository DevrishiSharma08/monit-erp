-- ============================================================================
-- FILE : 35_so_po_material_nullable.sql
-- DESC : Make MaterialId NULL-able on sales.SalesOrderLines and
--        procurement.PurchaseOrderItems so the SO / PO add-item forms can
--        accept FREE-TEXT item codes (custom one-off cuts the customer / mill
--        asks for without having to add a new master). When materialId is
--        NULL the row carries the typed Description (item code), GSM, Size,
--        Rate etc. as snapshot values; when it points to a real master the
--        master is the source of truth.
--
-- RUN  : Anytime — idempotent. Safe to re-run.
-- ============================================================================

PRINT '── Migration 35: SO/PO MaterialId → NULLable ──────────────';
GO

-- ── procurement.PurchaseOrderItems ─────────────────────────────────────────
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PurchaseOrderItems_Material')
BEGIN
    ALTER TABLE procurement.PurchaseOrderItems DROP CONSTRAINT FK_PurchaseOrderItems_Material;
    PRINT '  - Dropped FK_PurchaseOrderItems_Material';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('procurement.PurchaseOrderItems')
             AND name = 'MaterialId' AND is_nullable = 0)
BEGIN
    ALTER TABLE procurement.PurchaseOrderItems ALTER COLUMN MaterialId INT NULL;
    PRINT '  ✓ procurement.PurchaseOrderItems.MaterialId now NULLable';
END
ELSE
BEGIN
    PRINT '  ✓ procurement.PurchaseOrderItems.MaterialId already NULLable — skipped';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PurchaseOrderItems_Material')
BEGIN
    ALTER TABLE procurement.PurchaseOrderItems
        ADD CONSTRAINT FK_PurchaseOrderItems_Material
            FOREIGN KEY (MaterialId) REFERENCES masters.Materials(Id);
    PRINT '  + Re-added FK_PurchaseOrderItems_Material (now allows NULL)';
END
GO

-- ── sales.SalesOrderLines ──────────────────────────────────────────────────
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SalesOrderLines_Material')
BEGIN
    ALTER TABLE sales.SalesOrderLines DROP CONSTRAINT FK_SalesOrderLines_Material;
    PRINT '  - Dropped FK_SalesOrderLines_Material';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('sales.SalesOrderLines')
             AND name = 'MaterialId' AND is_nullable = 0)
BEGIN
    ALTER TABLE sales.SalesOrderLines ALTER COLUMN MaterialId INT NULL;
    PRINT '  ✓ sales.SalesOrderLines.MaterialId now NULLable';
END
ELSE
BEGIN
    PRINT '  ✓ sales.SalesOrderLines.MaterialId already NULLable — skipped';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SalesOrderLines_Material')
BEGIN
    ALTER TABLE sales.SalesOrderLines
        ADD CONSTRAINT FK_SalesOrderLines_Material
            FOREIGN KEY (MaterialId) REFERENCES masters.Materials(Id);
    PRINT '  + Re-added FK_SalesOrderLines_Material (now allows NULL)';
END
GO

PRINT '── Migration 35 complete. ─────────────────────────────────';
GO
