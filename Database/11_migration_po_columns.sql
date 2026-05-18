-- ============================================================
-- FILE : 11_migration_po_columns.sql
-- DESC : Add missing columns to procurement.PurchaseOrders
-- RUN  : After 05_procurement_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'ShipmentMode')
    ALTER TABLE procurement.PurchaseOrders ADD ShipmentMode NVARCHAR(30) NULL DEFAULT 'Normal';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'InvoiceParty')
    ALTER TABLE procurement.PurchaseOrders ADD InvoiceParty NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'InvoicePartyId')
    ALTER TABLE procurement.PurchaseOrders ADD InvoicePartyId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'MillSONumber')
    ALTER TABLE procurement.PurchaseOrders ADD MillSONumber NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'SpecialInstructions')
    ALTER TABLE procurement.PurchaseOrders ADD SpecialInstructions NVARCHAR(2000) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrderItems') AND name = 'Remark')
    ALTER TABLE procurement.PurchaseOrderItems ADD Remark NVARCHAR(500) NULL;
GO

PRINT N'Migration 11: PurchaseOrders missing columns added.';
GO
