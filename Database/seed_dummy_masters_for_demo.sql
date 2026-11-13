-- ============================================================================
-- FILE : seed_dummy_masters_for_demo.sql
-- DESC : LOCAL DEV ONLY. Seeds 2-3 dummy rows into every master table
--        (Localities, Units, PaperSizes, StockGroups, StockSubGroups/Quality,
--        StockCategories, ItemTypes, HsnCodes, Instructions, Transporters,
--        Warehouses, Mills, MillQualityGsm, Materials, Customers, Rates,
--        Salesmen) so a client demo has something to click through without
--        hand-typing every master in the UI. All names are placeholders
--        (ABC/PQR/XYZ) - nothing here is real Monit/Indus business data.
--
--        Run AFTER reset_local_testing_db_for_demo.sql (expects those tables
--        to be empty so FK chaining via SCOPE_IDENTITY() lines up cleanly;
--        safe to re-run on a table that still has rows too - it just adds
--        more dummy rows on top).
--
-- SAFETY: hard-locked to MonitPaperDB_Testing only.
-- ============================================================================

USE MonitPaperDB_Testing;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF DB_NAME() <> N'MonitPaperDB_Testing'
BEGIN
    RAISERROR('ABORT: hard-locked to MonitPaperDB_Testing (local dev only).', 16, 1);
    RETURN;
END
GO

BEGIN TRY
BEGIN TRANSACTION;

DECLARE @Loc1 INT, @Loc2 INT, @Loc3 INT;
DECLARE @Unit1 INT, @Unit2 INT, @Unit3 INT;
DECLARE @Size1 INT, @Size2 INT, @Size3 INT;
DECLARE @SG1 INT, @SG2 INT;
DECLARE @Qual1 INT, @Qual2 INT, @Qual3 INT;
DECLARE @Cat1 INT, @Cat2 INT;
DECLARE @IType1 INT, @IType2 INT;
DECLARE @Hsn1 INT, @Hsn2 INT;
DECLARE @Trn1 INT, @Trn2 INT;
DECLARE @Wh1 INT, @Wh2 INT;
DECLARE @Mill1 INT, @Mill2 INT;
DECLARE @Mqg1 INT, @Mqg2 INT;
DECLARE @Cust1 INT, @Cust2 INT;

-- 1. Localities -----------------------------------------------------------
INSERT INTO masters.Localities (Name, City, State, Description, CreatedBy) VALUES
    (N'ABC Nagar',            N'Indore',    N'Madhya Pradesh', N'Demo locality 1', 'SYSTEM');
SET @Loc1 = SCOPE_IDENTITY();
INSERT INTO masters.Localities (Name, City, State, Description, CreatedBy) VALUES
    (N'PQR Colony',           N'Indore',    N'Madhya Pradesh', N'Demo locality 2', 'SYSTEM');
SET @Loc2 = SCOPE_IDENTITY();
INSERT INTO masters.Localities (Name, City, State, Description, CreatedBy) VALUES
    (N'XYZ Industrial Area',  N'Pithampur', N'Madhya Pradesh', N'Demo locality 3', 'SYSTEM');
SET @Loc3 = SCOPE_IDENTITY();

-- 2. Units ------------------------------------------------------------------
INSERT INTO masters.Units (Name, Description, CreatedBy) VALUES (N'KG',     N'Kilograms',    'SYSTEM');
SET @Unit1 = SCOPE_IDENTITY();
INSERT INTO masters.Units (Name, Description, CreatedBy) VALUES (N'SHEETS', N'Sheet count',  'SYSTEM');
SET @Unit2 = SCOPE_IDENTITY();
INSERT INTO masters.Units (Name, Description, CreatedBy) VALUES (N'REAM',   N'Ream (500 sheets)', 'SYSTEM');
SET @Unit3 = SCOPE_IDENTITY();

-- 3. Paper Sizes --------------------------------------------------------------
INSERT INTO masters.PaperSizes (Label, WidthMM, HeightMM, IsCustom, SortOrder, CreatedBy) VALUES
    (N'ABC Size',  210, 297, 0, 1, 'SYSTEM');
SET @Size1 = SCOPE_IDENTITY();
INSERT INTO masters.PaperSizes (Label, WidthMM, HeightMM, IsCustom, SortOrder, CreatedBy) VALUES
    (N'PQR Size',  297, 420, 0, 2, 'SYSTEM');
SET @Size2 = SCOPE_IDENTITY();
INSERT INTO masters.PaperSizes (Label, WidthMM, HeightMM, IsCustom, SortOrder, CreatedBy) VALUES
    (N'XYZ Custom Size', 500, 700, 1, 3, 'SYSTEM');
SET @Size3 = SCOPE_IDENTITY();

-- 4. Stock Groups -------------------------------------------------------------
INSERT INTO masters.StockGroups (Code, Name, Description, CreatedBy) VALUES
    (N'ABC', N'ABC Paper Group', N'Demo stock group 1', 'SYSTEM');
SET @SG1 = SCOPE_IDENTITY();
INSERT INTO masters.StockGroups (Code, Name, Description, CreatedBy) VALUES
    (N'PQR', N'PQR Board Group', N'Demo stock group 2', 'SYSTEM');
SET @SG2 = SCOPE_IDENTITY();

-- 5. Stock Sub-Groups (= "Quality" master in the UI) -------------------------
INSERT INTO masters.StockSubGroups (StockGroupId, Name, Alias, CreatedBy) VALUES (@SG1, N'ABC Quality', N'ABCQ', 'SYSTEM');
SET @Qual1 = SCOPE_IDENTITY();
INSERT INTO masters.StockSubGroups (StockGroupId, Name, Alias, CreatedBy) VALUES (@SG1, N'PQR Quality', N'PQRQ', 'SYSTEM');
SET @Qual2 = SCOPE_IDENTITY();
INSERT INTO masters.StockSubGroups (StockGroupId, Name, Alias, CreatedBy) VALUES (@SG2, N'XYZ Quality', N'XYZQ', 'SYSTEM');
SET @Qual3 = SCOPE_IDENTITY();

-- 6. Stock Categories ---------------------------------------------------------
INSERT INTO masters.StockCategories (StockGroupId, Code, Name, GsmType, Gsm, GsmMin, GsmMax, CreatedBy) VALUES
    (@SG1, N'CAT-ABC', N'ABC Category', N'single', 90,   NULL, NULL, 'SYSTEM');
SET @Cat1 = SCOPE_IDENTITY();
INSERT INTO masters.StockCategories (StockGroupId, Code, Name, GsmType, Gsm, GsmMin, GsmMax, CreatedBy) VALUES
    (@SG2, N'CAT-PQR', N'PQR Category', N'range', NULL, 60,   100,  'SYSTEM');
SET @Cat2 = SCOPE_IDENTITY();

-- 7. Item Types ----------------------------------------------------------------
INSERT INTO masters.ItemTypes (Code, Name, Description, CreatedBy) VALUES (N'ABC', N'ABC Item Type', N'Demo item type 1', 'SYSTEM');
SET @IType1 = SCOPE_IDENTITY();
INSERT INTO masters.ItemTypes (Code, Name, Description, CreatedBy) VALUES (N'PQR', N'PQR Item Type', N'Demo item type 2', 'SYSTEM');
SET @IType2 = SCOPE_IDENTITY();

-- 8. HSN Codes -------------------------------------------------------------------
INSERT INTO masters.HsnCodes (Code, Description, GstPercent, CreatedBy) VALUES (N'48025500', N'ABC Demo Paper HSN', 12, 'SYSTEM');
SET @Hsn1 = SCOPE_IDENTITY();
INSERT INTO masters.HsnCodes (Code, Description, GstPercent, CreatedBy) VALUES (N'48041100', N'PQR Demo Board HSN', 18, 'SYSTEM');
SET @Hsn2 = SCOPE_IDENTITY();

-- 9. Instructions ------------------------------------------------------------------
INSERT INTO masters.Instructions (Title, ApplicableTo, LinesJson, CreatedBy) VALUES
    (N'ABC Standard Instructions', N'All',  N'["Handle with care","Keep dry"]', 'SYSTEM');
INSERT INTO masters.Instructions (Title, ApplicableTo, LinesJson, CreatedBy) VALUES
    (N'PQR Mill Instructions',     N'Mill', N'["Check quality before dispatch"]', 'SYSTEM');

-- 10. Transporters -------------------------------------------------------------------
INSERT INTO masters.Transporters (Code, Name, ContactPerson, Phone, Email, GSTNo, PAN, Address, CreatedBy) VALUES
    (N'TRN-ABC', N'ABC Transport Co', N'Mr. ABC Sharma', N'9000000001', N'abc@transport.test', N'23ABCDE1234F1Z5', N'ABCDE1234F', N'ABC Road, Indore', 'SYSTEM');
SET @Trn1 = SCOPE_IDENTITY();
INSERT INTO masters.Transporters (Code, Name, ContactPerson, Phone, Email, GSTNo, PAN, Address, CreatedBy) VALUES
    (N'TRN-PQR', N'PQR Roadways',    N'Mr. PQR Verma',  N'9000000002', N'pqr@transport.test', N'23PQRDE1234F1Z5', N'PQRDE1234F', N'PQR Nagar, Indore', 'SYSTEM');
SET @Trn2 = SCOPE_IDENTITY();

-- 11. Warehouses -------------------------------------------------------------------
INSERT INTO masters.Warehouses (Code, Name, Address, City, Manager, Phone, Unit, CreatedBy) VALUES
    (N'WH-ABC', N'ABC Godown',    N'ABC Industrial Area, Indore',    N'Indore',    N'Mr. ABC Manager', N'9000000010', N'Unit 1', 'SYSTEM');
SET @Wh1 = SCOPE_IDENTITY();
INSERT INTO masters.Warehouses (Code, Name, Address, City, Manager, Phone, Unit, CreatedBy) VALUES
    (N'WH-PQR', N'PQR Warehouse', N'PQR Industrial Area, Pithampur', N'Pithampur', N'Mr. PQR Manager', N'9000000011', N'Unit 2', 'SYSTEM');
SET @Wh2 = SCOPE_IDENTITY();

-- 12. Mills -------------------------------------------------------------------
INSERT INTO masters.Mills (Code, Name, City, State, ContactPerson, Phone, Email, GSTNo, PAN, PaymentTerms, FreightType, OwnerName, CreatedBy) VALUES
    (N'MILL-ABC', N'ABC Paper Mills',      N'Indore', N'Madhya Pradesh', N'Mr. ABC Owner', N'9000000020', N'abc@mill.test', N'23ABCDE5678F1Z5', N'ABCDE5678F', N'Advance', N'ToPay', N'Mr. ABC Owner', 'SYSTEM');
SET @Mill1 = SCOPE_IDENTITY();
INSERT INTO masters.Mills (Code, Name, City, State, ContactPerson, Phone, Email, GSTNo, PAN, PaymentTerms, FreightType, OwnerName, CreatedBy) VALUES
    (N'MILL-PQR', N'PQR Paper Industries', N'Ujjain', N'Madhya Pradesh', N'Mr. PQR Owner', N'9000000021', N'pqr@mill.test', N'23PQRDE5678F1Z5', N'PQRDE5678F', N'Credit',  N'Paid',  N'Mr. PQR Owner', 'SYSTEM');
SET @Mill2 = SCOPE_IDENTITY();

-- 13. Mill Quality GSM (MQG) ----------------------------------------------------
INSERT INTO masters.MillQualityGsm (Code, MillId, QualityId, GsmMin, GsmMax, Type, CreatedBy) VALUES
    (N'ABC-MQG-1', @Mill1, @Qual1, 80, 100, N'Standard', 'SYSTEM');
SET @Mqg1 = SCOPE_IDENTITY();
INSERT INTO masters.MillQualityGsm (Code, MillId, QualityId, GsmMin, GsmMax, Type, CreatedBy) VALUES
    (N'PQR-MQG-1', @Mill2, @Qual2, 60, 90,  N'Standard', 'SYSTEM');
SET @Mqg2 = SCOPE_IDENTITY();

-- 14. Materials -------------------------------------------------------------------
INSERT INTO masters.Materials
    (Code, MillId, CategoryId, ItemTypeId, StockGroupId, GSM, SizeId, PackingType, Description,
     QualityId, SizeLength, SizeWidth, SheetsPerPacket, PacketsPerBundle, BundlesPerBox, HsnCodeId, Grain, CreatedBy)
VALUES
    (N'ABC-MILL-90-SZ1-BND', @Mill1, @Cat1, @IType1, @SG1, 90, @Size1, N'Bundle', N'ABC demo material',
     @Qual1, 21.0, 29.7, 500, 10, 5, @Hsn1, N'Long',  'SYSTEM'),
    (N'PQR-MILL-70-SZ2-BND', @Mill2, @Cat2, @IType2, @SG2, 70, @Size2, N'Bundle', N'PQR demo material',
     @Qual2, 29.7, 42.0, 500, 10, 5, @Hsn2, N'Short', 'SYSTEM');

-- 15. Customers -------------------------------------------------------------------
INSERT INTO masters.Customers
    (Code, CompanyName, Name, ContactPerson, Phone, Email, GSTNo, PAN, TallyLedgerName,
     OfficeAddress, BillingAddress, City, State, PaymentTerms, CreditLimit, CreditDays, LocalityId, OwnerName, CreatedBy)
VALUES
    (N'CUST-ABC', N'ABC Traders Pvt Ltd', N'ABC Traders Pvt Ltd', N'Mr. ABC Contact', N'9000000030', N'abc@customer.test',
     N'23ABCDE9012F1Z5', N'ABCDE9012F', N'ABC Traders', N'ABC Office Address, Indore', N'ABC Billing Address, Indore',
     N'Indore', N'Madhya Pradesh', N'Net 30', 500000, 30, @Loc1, N'Mr. ABC Owner', 'SYSTEM');
SET @Cust1 = SCOPE_IDENTITY();
INSERT INTO masters.Customers
    (Code, CompanyName, Name, ContactPerson, Phone, Email, GSTNo, PAN, TallyLedgerName,
     OfficeAddress, BillingAddress, City, State, PaymentTerms, CreditLimit, CreditDays, LocalityId, OwnerName, CreatedBy)
VALUES
    (N'CUST-PQR', N'PQR Enterprises', N'PQR Enterprises', N'Mr. PQR Contact', N'9000000031', N'pqr@customer.test',
     N'23PQRDE9012F1Z5', N'PQRDE9012F', N'PQR Enterprises', N'PQR Office Address, Indore', N'PQR Billing Address, Indore',
     N'Indore', N'Madhya Pradesh', N'Net 15', 300000, 15, @Loc2, N'Mr. PQR Owner', 'SYSTEM');
SET @Cust2 = SCOPE_IDENTITY();

-- 16. Rates -------------------------------------------------------------------
INSERT INTO masters.Rates (MQGId, RateType, RateCategory, CustomerId, Rate, EffectiveFrom, Discount, CreatedBy) VALUES
    (@Mqg1, N'Base', N'Standard', @Cust1, 55.50, CAST(GETDATE() AS DATE), 2.00, 'SYSTEM');
INSERT INTO masters.Rates (MQGId, RateType, RateCategory, CustomerId, Rate, EffectiveFrom, Discount, CreatedBy) VALUES
    (@Mqg2, N'Base', N'Standard', @Cust2, 48.75, CAST(GETDATE() AS DATE), 1.50, 'SYSTEM');

-- 17. Salesmen -------------------------------------------------------------------
INSERT INTO masters.Salesmen (Code, Name, Phone, Email, Territory, CreatedBy) VALUES
    (N'SM-ABC', N'ABC Salesman', N'9000000040', N'abcsales@indus.test', N'Indore City', 'SYSTEM');
INSERT INTO masters.Salesmen (Code, Name, Phone, Email, Territory, CreatedBy) VALUES
    (N'SM-PQR', N'PQR Salesman', N'9000000041', N'pqrsales@indus.test', N'Pithampur',   'SYSTEM');

COMMIT TRANSACTION;
PRINT 'DONE: dummy master data seeded across all 17 masters tables.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'FAILED - rolled back. Error: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO
