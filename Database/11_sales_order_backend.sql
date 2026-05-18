-- ============================================================
-- FILE : 11_sales_order_backend.sql
-- DESC : Extend sales.SalesOrders and sales.SalesOrderLines with
--        columns needed for the full SO form + backend integration.
-- RUN  : After 04_sales_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ── sales.SalesOrders — new columns ───────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'ContactPersonId')
    ALTER TABLE sales.SalesOrders ADD ContactPersonId INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'SalesmanName')
    ALTER TABLE sales.SalesOrders ADD SalesmanName NVARCHAR(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'DeliveryPartyId')
    ALTER TABLE sales.SalesOrders ADD DeliveryPartyId INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'RequiredDeliveryDate')
    ALTER TABLE sales.SalesOrders ADD RequiredDeliveryDate DATE NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'InsurancePolicyNo')
    ALTER TABLE sales.SalesOrders ADD InsurancePolicyNo NVARCHAR(200) NULL;
GO

-- FK: ContactPersonId → masters.CustomerContacts
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SalesOrders_ContactPerson')
    ALTER TABLE sales.SalesOrders
        ADD CONSTRAINT FK_SalesOrders_ContactPerson
        FOREIGN KEY (ContactPersonId) REFERENCES masters.CustomerContacts(Id);
GO

-- FK: DeliveryPartyId → masters.Customers
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SalesOrders_DeliveryParty')
    ALTER TABLE sales.SalesOrders
        ADD CONSTRAINT FK_SalesOrders_DeliveryParty
        FOREIGN KEY (DeliveryPartyId) REFERENCES masters.Customers(Id);
GO

-- ── sales.SalesOrderLines — new columns ───────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrderLines') AND name = 'Qty')
    ALTER TABLE sales.SalesOrderLines ADD Qty INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrderLines') AND name = 'Discount')
    ALTER TABLE sales.SalesOrderLines ADD Discount DECIMAL(18,4) NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrderLines') AND name = 'FinalPrice')
    ALTER TABLE sales.SalesOrderLines ADD FinalPrice DECIMAL(18,4) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrderLines') AND name = 'DeliveryAddress')
    ALTER TABLE sales.SalesOrderLines ADD DeliveryAddress NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrderLines') AND name = 'LineStatus')
    ALTER TABLE sales.SalesOrderLines ADD LineStatus NVARCHAR(50) NOT NULL DEFAULT 'Pending Allocation';
GO

PRINT '✓ Sales Order backend migration complete.';
GO
