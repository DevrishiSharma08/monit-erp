-- ============================================================
-- FILE : 22_grn_packing_billing.sql
-- DESC : Adds packing format fields and billing rate to GRNs.
--        Adds packing format fields to StockLots for traceability.
--        PackingType: Sheets | Packets | Bundle
--        BillingRate: actual rate on mill invoice (vs PO agreed rate)
--        ItemInvoiceNo: per-item invoice reference
--        DispatchDate: date mill actually dispatched the goods
-- RUN  : After 21_grn_delivery_routing.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ============================================================
-- SECTION A: GRNs — dispatch date + invoice + billing rate
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'DispatchDate')
BEGIN
    ALTER TABLE inventory.GRNs ADD DispatchDate DATE NULL;
    PRINT '  + GRNs.DispatchDate added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'ItemInvoiceNo')
BEGIN
    ALTER TABLE inventory.GRNs ADD ItemInvoiceNo NVARCHAR(100) NULL;
    PRINT '  + GRNs.ItemInvoiceNo added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'BillingRate')
BEGIN
    ALTER TABLE inventory.GRNs ADD BillingRate DECIMAL(18,4) NULL;
    PRINT '  + GRNs.BillingRate added';
END
GO

-- ============================================================
-- SECTION B: GRNs — packing format
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'PackingType')
BEGIN
    ALTER TABLE inventory.GRNs ADD PackingType NVARCHAR(20) NOT NULL DEFAULT 'Sheets';
    PRINT '  + GRNs.PackingType added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'SheetsPerPacket')
BEGIN
    ALTER TABLE inventory.GRNs ADD SheetsPerPacket INT NULL;
    PRINT '  + GRNs.SheetsPerPacket added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'PacketsPerBundle')
BEGIN
    ALTER TABLE inventory.GRNs ADD PacketsPerBundle INT NULL;
    PRINT '  + GRNs.PacketsPerBundle added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'NoOfPackets')
BEGIN
    ALTER TABLE inventory.GRNs ADD NoOfPackets INT NULL;
    PRINT '  + GRNs.NoOfPackets added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'NoOfBundles')
BEGIN
    ALTER TABLE inventory.GRNs ADD NoOfBundles INT NULL;
    PRINT '  + GRNs.NoOfBundles added';
END
GO

-- ============================================================
-- SECTION C: StockLots — packing format (for warehouse traceability)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.StockLots') AND name = 'PackingType')
BEGIN
    ALTER TABLE inventory.StockLots ADD PackingType NVARCHAR(20) NULL;
    PRINT '  + StockLots.PackingType added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.StockLots') AND name = 'SheetsPerPacket')
BEGIN
    ALTER TABLE inventory.StockLots ADD SheetsPerPacket INT NULL;
    PRINT '  + StockLots.SheetsPerPacket added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.StockLots') AND name = 'PacketsPerBundle')
BEGIN
    ALTER TABLE inventory.StockLots ADD PacketsPerBundle INT NULL;
    PRINT '  + StockLots.PacketsPerBundle added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.StockLots') AND name = 'NoOfPackets')
BEGIN
    ALTER TABLE inventory.StockLots ADD NoOfPackets INT NULL;
    PRINT '  + StockLots.NoOfPackets added';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventory.StockLots') AND name = 'NoOfBundles')
BEGIN
    ALTER TABLE inventory.StockLots ADD NoOfBundles INT NULL;
    PRINT '  + StockLots.NoOfBundles added';
END
GO

PRINT '✓ 22_grn_packing_billing.sql complete.';
GO
