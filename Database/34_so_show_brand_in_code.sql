-- ============================================================================
-- FILE : 34_so_show_brand_in_code.sql
-- DESC : Adds ShowBrandInItemCode (BIT NOT NULL DEFAULT 0) to sales.SalesOrders
--        so a sales order can ad-hoc display its item codes WITH the brand
--        name inserted (e.g. "B1/MAPLITHO/MAP/50/23x36" instead of the default
--        brand-less "B1/MAPLITHO/50/23x36"). Default OFF — only special-case
--        customer requests turn it on; the stored Material.Code stays
--        brand-less so item codes don't get unnecessarily long.
--
-- RUN  : Anytime — idempotent. Safe to re-run.
-- ============================================================================

PRINT '── Migration 34: ShowBrandInItemCode on sales.SalesOrders ──';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('sales.SalesOrders')
                 AND name = 'ShowBrandInItemCode')
BEGIN
    ALTER TABLE sales.SalesOrders
        ADD ShowBrandInItemCode BIT NOT NULL
            CONSTRAINT DF_SalesOrders_ShowBrandInItemCode DEFAULT 0;
    PRINT '  + ShowBrandInItemCode → sales.SalesOrders';
END

ELSE
BEGIN
    PRINT '  ✓ ShowBrandInItemCode already present — skipped';
END
GO

PRINT '── Migration 34 complete. ──────────────────────────────────';
GO
