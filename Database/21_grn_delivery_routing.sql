-- ============================================================
-- FILE : 21_grn_delivery_routing.sql
-- DESC : Three PO billing modes (Normal/InvoiceOverride/Blind)
--        + per-GRN delivery routing (StockIn/DirectToClient/Split).
--        Adds BillingMode/OverrideClientName to PurchaseOrders.
--        Adds GRNDeliveryMode/DirectQty/StockQty/DirectClient* to GRNs.
-- RUN  : After 20_fix_grn_number_width.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ============================================================
-- SECTION A: PO Billing Modes
-- Normal     → standard; mill sees real client
-- InvoiceOverride → agency invoices mill; mill sees override name
-- Blind      → mill does not know end client at all
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'BillingMode'
)
BEGIN
    ALTER TABLE procurement.PurchaseOrders
        ADD BillingMode NVARCHAR(30) NOT NULL DEFAULT 'Normal';
    PRINT '  + PurchaseOrders.BillingMode added';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'OverrideClientName'
)
BEGIN
    ALTER TABLE procurement.PurchaseOrders
        ADD OverrideClientName NVARCHAR(200) NULL;
    PRINT '  + PurchaseOrders.OverrideClientName added';
END
GO

-- ============================================================
-- SECTION B: GRN Delivery Routing
-- GRNDeliveryMode: StockIn / DirectToClient / Split
--   StockIn       → all good qty goes to inventory.StockLots
--   DirectToClient→ all good qty goes direct to client; no StockLot
--   Split         → StockQty to inventory, DirectQty to client
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'GRNDeliveryMode'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD GRNDeliveryMode NVARCHAR(30) NOT NULL DEFAULT 'StockIn';
    PRINT '  + GRNs.GRNDeliveryMode added';
END
GO

-- Sheets going directly to client (0 for StockIn; > 0 for DirectToClient/Split)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'DirectQty'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD DirectQty DECIMAL(18,4) NOT NULL DEFAULT 0;
    PRINT '  + GRNs.DirectQty added';
END
GO

-- Sheets going to inventory StockLot (ReceivedQty - DamagedQty - DirectQty)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'StockQty'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD StockQty DECIMAL(18,4) NOT NULL DEFAULT 0;
    PRINT '  + GRNs.StockQty added';
END
GO

-- Client receiving direct shipment (FK to masters.Customers)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'DirectClientId'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD DirectClientId INT NULL;
    PRINT '  + GRNs.DirectClientId added';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_GRNs_DirectClient'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD CONSTRAINT FK_GRNs_DirectClient
            FOREIGN KEY (DirectClientId)
            REFERENCES masters.Customers(Id);
    PRINT '  + FK_GRNs_DirectClient added';
END
GO

-- Denormalized for display without join
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'DirectClientName'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD DirectClientName NVARCHAR(200) NULL;
    PRINT '  + GRNs.DirectClientName added';
END
GO

PRINT '✓ 21_grn_delivery_routing.sql complete.';
GO
