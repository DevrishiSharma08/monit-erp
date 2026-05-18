-- ============================================================
-- Migration: Schema updates applied after initial DB creation.
-- Run this once against any DB created from 03_masters_tables.sql
-- before these columns/tables were added.
-- All statements are idempotent (safe to re-run).
-- ============================================================

PRINT '── Migration: schema updates ────────────────────────────';
GO

-- ============================================================
-- 0. Make stale NOT NULL columns nullable
--    (old schema had these; current code no longer provides them)
-- ============================================================

-- masters.StockGroups.Code — existed in old schema, removed in current
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('masters.StockGroups') AND name = 'Code' AND is_nullable = 0)
BEGIN
    DECLARE @sg_code_type NVARCHAR(200);
    SELECT @sg_code_type = DATA_TYPE +
        CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL
             THEN '(' + CASE WHEN CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                             ELSE CAST(CHARACTER_MAXIMUM_LENGTH AS NVARCHAR) END + ')'
             ELSE '' END
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='masters' AND TABLE_NAME='StockGroups' AND COLUMN_NAME='Code';
    EXEC('ALTER TABLE masters.StockGroups ALTER COLUMN Code ' + @sg_code_type + ' NULL');
    PRINT '  ~ masters.StockGroups.Code made nullable';
END
GO

-- Drop legacy unique constraint on StockGroups.Code
-- (old schema had Code NOT NULL UNIQUE; current code never provides Code, so NULLs collide)
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_StockGroups_Code' AND parent_object_id = OBJECT_ID('masters.StockGroups'))
BEGIN
    ALTER TABLE masters.StockGroups DROP CONSTRAINT UQ_StockGroups_Code;
    PRINT '  ~ masters.StockGroups: dropped legacy UQ_StockGroups_Code constraint';
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'UQ_StockGroups_Code' AND object_id = OBJECT_ID('masters.StockGroups') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_StockGroups_Code ON masters.StockGroups;
    PRINT '  ~ masters.StockGroups: dropped legacy UQ_StockGroups_Code index';
END
GO

-- masters.StockCategories.StockGroupId — existed in old schema, removed in current
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('masters.StockCategories') AND name = 'StockGroupId' AND is_nullable = 0)
BEGIN
    ALTER TABLE masters.StockCategories ALTER COLUMN StockGroupId INT NULL;
    PRINT '  ~ masters.StockCategories.StockGroupId made nullable';
END
GO

-- ============================================================
-- 1. masters.Mills  — add contact columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Mills') AND name = 'OwnerName')
BEGIN
    ALTER TABLE masters.Mills ADD OwnerName NVARCHAR(200) NULL;
    PRINT '  + masters.Mills.OwnerName';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Mills') AND name = 'Phone')
BEGIN
    ALTER TABLE masters.Mills ADD Phone NVARCHAR(20) NULL;
    PRINT '  + masters.Mills.Phone';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Mills') AND name = 'Email')
BEGIN
    ALTER TABLE masters.Mills ADD Email NVARCHAR(200) NULL;
    PRINT '  + masters.Mills.Email';
END
GO

-- ============================================================
-- 2. masters.StockCategories  — add GSM type/value columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.StockCategories') AND name = 'GsmType')
BEGIN
    ALTER TABLE masters.StockCategories ADD GsmType NVARCHAR(10) NOT NULL DEFAULT 'single';
    PRINT '  + masters.StockCategories.GsmType';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.StockCategories') AND name = 'Gsm')
BEGIN
    ALTER TABLE masters.StockCategories ADD Gsm INT NULL;
    PRINT '  + masters.StockCategories.Gsm';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.StockCategories') AND name = 'GsmMin')
BEGIN
    ALTER TABLE masters.StockCategories ADD GsmMin INT NULL;
    PRINT '  + masters.StockCategories.GsmMin';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.StockCategories') AND name = 'GsmMax')
BEGIN
    ALTER TABLE masters.StockCategories ADD GsmMax INT NULL;
    PRINT '  + masters.StockCategories.GsmMax';
END
GO

-- ============================================================
-- 3. masters.MillQualityGsm  — create new table
-- ============================================================
IF OBJECT_ID('masters.MillQualityGsm', 'U') IS NULL
BEGIN
    CREATE TABLE masters.MillQualityGsm (
        Id          INT             IDENTITY(1,1)   NOT NULL,
        Code        NVARCHAR(100)   NOT NULL,
        MillId      INT             NOT NULL,
        QualityId   INT             NOT NULL,
        GsmMin      INT             NOT NULL,
        GsmMax      INT             NOT NULL,
        [Type]      NVARCHAR(20)    NOT NULL,
        IsActive    BIT             NOT NULL    DEFAULT 1,

        CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
        CreatedBy   NVARCHAR(100)   NOT NULL,
        UpdatedAt   DATETIME2       NULL,
        UpdatedBy   NVARCHAR(100)   NULL,
        IsDeleted   BIT             NOT NULL    DEFAULT 0,
        DeletedAt   DATETIME2       NULL,
        DeletedBy   NVARCHAR(100)   NULL,

        CONSTRAINT PK_MillQualityGsm            PRIMARY KEY (Id),
        CONSTRAINT UQ_MillQualityGsm_Code       UNIQUE (Code),
        CONSTRAINT UQ_MillQualityGsm_Combo      UNIQUE (MillId, QualityId, GsmMin, GsmMax, [Type]),
        CONSTRAINT FK_MillQualityGsm_Mill       FOREIGN KEY (MillId)    REFERENCES masters.Mills(Id),
        CONSTRAINT FK_MillQualityGsm_Quality    FOREIGN KEY (QualityId) REFERENCES masters.StockSubGroups(Id)
    );
    PRINT '  + masters.MillQualityGsm (created)';
END
GO

-- ============================================================
-- 4. masters.Materials  — add new columns in-place
-- Cannot DROP because transaction tables have FK references to it.
-- New columns are added as nullable so existing rows are unaffected.
-- The app only INSERTs/SELECTs the new columns; old rows with NULLs
-- will be ignored (IsActive=0 or IsDeleted=1 from the old code).
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'MillId')
BEGIN
    ALTER TABLE masters.Materials ADD MillId INT NULL;
    PRINT '  + masters.Materials.MillId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'QualityId')
BEGIN
    ALTER TABLE masters.Materials ADD QualityId INT NULL;
    PRINT '  + masters.Materials.QualityId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'ItemTypeId')
BEGIN
    ALTER TABLE masters.Materials ADD ItemTypeId INT NULL;
    PRINT '  + masters.Materials.ItemTypeId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'GSM')
BEGIN
    ALTER TABLE masters.Materials ADD GSM INT NULL;
    PRINT '  + masters.Materials.GSM';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'SizeLength')
BEGIN
    ALTER TABLE masters.Materials ADD SizeLength DECIMAL(10,2) NULL;
    PRINT '  + masters.Materials.SizeLength';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'SizeWidth')
BEGIN
    ALTER TABLE masters.Materials ADD SizeWidth DECIMAL(10,2) NULL;
    PRINT '  + masters.Materials.SizeWidth';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'PackingType')
BEGIN
    ALTER TABLE masters.Materials ADD PackingType NVARCHAR(20) NULL DEFAULT 'Sheet';
    PRINT '  + masters.Materials.PackingType';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'SheetsPerPacket')
BEGIN
    ALTER TABLE masters.Materials ADD SheetsPerPacket INT NULL;
    PRINT '  + masters.Materials.SheetsPerPacket';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'PacketsPerBundle')
BEGIN
    ALTER TABLE masters.Materials ADD PacketsPerBundle INT NULL;
    PRINT '  + masters.Materials.PacketsPerBundle';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'BundlesPerBox')
BEGIN
    ALTER TABLE masters.Materials ADD BundlesPerBox INT NULL;
    PRINT '  + masters.Materials.BundlesPerBox';
END
GO

-- Add FK constraints for new columns (skip if already exist)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Materials_Mill' AND parent_object_id = OBJECT_ID('masters.Materials'))
BEGIN
    ALTER TABLE masters.Materials ADD CONSTRAINT FK_Materials_Mill FOREIGN KEY (MillId) REFERENCES masters.Mills(Id);
    PRINT '  + FK_Materials_Mill';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Materials_Quality' AND parent_object_id = OBJECT_ID('masters.Materials'))
BEGIN
    ALTER TABLE masters.Materials ADD CONSTRAINT FK_Materials_Quality FOREIGN KEY (QualityId) REFERENCES masters.StockSubGroups(Id);
    PRINT '  + FK_Materials_Quality';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Materials_ItemType' AND parent_object_id = OBJECT_ID('masters.Materials'))
BEGIN
    ALTER TABLE masters.Materials ADD CONSTRAINT FK_Materials_ItemType FOREIGN KEY (ItemTypeId) REFERENCES masters.ItemTypes(Id);
    PRINT '  + FK_Materials_ItemType';
END
GO

-- ============================================================
-- 5. masters.Rates  — recreate if old schema (pre-redesign)
-- Old schema had: MaterialId, SaleRate, PurchaseRate, EffectiveTo
-- New schema has: MQGId, RateType, RateCategory, CustomerId, Rate, EffectiveFrom
-- ============================================================
IF OBJECT_ID('masters.Rates', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name IN ('MaterialId','SaleRate','PurchaseRate'))
BEGIN
    PRINT '  ~ masters.Rates: old schema detected — dropping and recreating';
    DROP TABLE masters.Rates;
END
GO

IF OBJECT_ID('masters.Rates', 'U') IS NULL
BEGIN
    CREATE TABLE masters.Rates (
        Id              INT             IDENTITY(1,1)   NOT NULL,
        MQGId           INT             NOT NULL,
        RateType        NVARCHAR(10)    NOT NULL,
        RateCategory    NVARCHAR(10)    NULL,
        CustomerId      INT             NULL,
        Rate            DECIMAL(18,4)   NOT NULL,
        EffectiveFrom   DATE            NOT NULL,
        IsActive        BIT             NOT NULL    DEFAULT 1,

        CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
        CreatedBy   NVARCHAR(100)   NOT NULL,
        UpdatedAt   DATETIME2       NULL,
        UpdatedBy   NVARCHAR(100)   NULL,
        IsDeleted   BIT             NOT NULL    DEFAULT 0,
        DeletedAt   DATETIME2       NULL,
        DeletedBy   NVARCHAR(100)   NULL,

        CONSTRAINT PK_Rates          PRIMARY KEY (Id),
        CONSTRAINT FK_Rates_MQG      FOREIGN KEY (MQGId)     REFERENCES masters.MillQualityGsm(Id),
        CONSTRAINT FK_Rates_Customer FOREIGN KEY (CustomerId) REFERENCES masters.Customers(Id)
    );
    PRINT '  + masters.Rates (created with new schema)';
END
GO

-- ============================================================
-- 6. masters.Mills  — nullify any legacy NOT NULL columns
--    (columns not in the current INSERT list that have no default)
-- ============================================================
IF OBJECT_ID('masters.Mills', 'U') IS NOT NULL
BEGIN
    DECLARE @mills_sql NVARCHAR(MAX) = '';
    SELECT @mills_sql += 'ALTER TABLE masters.Mills ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.Mills') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'Mills'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,Code,Name,OwnerName,Phone,Email,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@mills_sql,'')) > 0
    BEGIN
        EXEC(@mills_sql);
        PRINT '  ~ masters.Mills: legacy NOT NULL columns made nullable';
    END
END
GO

-- ============================================================
-- 7. masters.Customers  — nullify legacy columns + add new ones
-- ============================================================
IF OBJECT_ID('masters.Customers', 'U') IS NOT NULL
BEGIN
    DECLARE @cust_sql NVARCHAR(MAX) = '';
    SELECT @cust_sql += 'ALTER TABLE masters.Customers ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.Customers') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'Customers'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,Name,OwnerName,Phone,Email,GSTNo,BillingAddress,CreditLimit,CreditDays,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@cust_sql,'')) > 0
    BEGIN
        EXEC(@cust_sql);
        PRINT '  ~ masters.Customers: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'Name')
BEGIN
    ALTER TABLE masters.Customers ADD Name NVARCHAR(200) NULL;
    PRINT '  + masters.Customers.Name';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'OwnerName')
BEGIN
    ALTER TABLE masters.Customers ADD OwnerName NVARCHAR(200) NULL;
    PRINT '  + masters.Customers.OwnerName';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'Phone')
BEGIN
    ALTER TABLE masters.Customers ADD Phone NVARCHAR(20) NULL;
    PRINT '  + masters.Customers.Phone';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'Email')
BEGIN
    ALTER TABLE masters.Customers ADD Email NVARCHAR(200) NULL;
    PRINT '  + masters.Customers.Email';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'GSTNo')
BEGIN
    ALTER TABLE masters.Customers ADD GSTNo NVARCHAR(20) NULL;
    PRINT '  + masters.Customers.GSTNo';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'BillingAddress')
BEGIN
    ALTER TABLE masters.Customers ADD BillingAddress NVARCHAR(500) NULL;
    PRINT '  + masters.Customers.BillingAddress';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'CreditLimit')
BEGIN
    ALTER TABLE masters.Customers ADD CreditLimit DECIMAL(18,4) NOT NULL DEFAULT 0;
    PRINT '  + masters.Customers.CreditLimit';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'CreditDays')
BEGIN
    ALTER TABLE masters.Customers ADD CreditDays INT NOT NULL DEFAULT 0;
    PRINT '  + masters.Customers.CreditDays';
END
GO

-- ============================================================
-- 8. masters.CustomerContacts  — add Name if old schema had different column
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.CustomerContacts') AND name = 'Name')
BEGIN
    ALTER TABLE masters.CustomerContacts ADD Name NVARCHAR(200) NULL;
    PRINT '  + masters.CustomerContacts.Name';
END
GO

IF OBJECT_ID('masters.CustomerContacts', 'U') IS NOT NULL
BEGIN
    DECLARE @cc_sql NVARCHAR(MAX) = '';
    SELECT @cc_sql += 'ALTER TABLE masters.CustomerContacts ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.CustomerContacts') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'CustomerContacts'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,CustomerId,Name,Designation,Phone,Email,IsPrimary,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@cc_sql,'')) > 0
    BEGIN
        EXEC(@cc_sql);
        PRINT '  ~ masters.CustomerContacts: legacy NOT NULL columns made nullable';
    END
END
GO

-- ============================================================
-- 9. masters.Warehouses  — add missing columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Warehouses') AND name = 'Name')
BEGIN
    ALTER TABLE masters.Warehouses ADD Name NVARCHAR(200) NULL;
    PRINT '  + masters.Warehouses.Name';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Warehouses') AND name = 'Unit')
BEGIN
    ALTER TABLE masters.Warehouses ADD Unit NVARCHAR(200) NULL;
    PRINT '  + masters.Warehouses.Unit';
END
GO

-- ============================================================
-- 10. masters.Transporters  — nullify legacy columns + add new ones
-- ============================================================
IF OBJECT_ID('masters.Transporters', 'U') IS NOT NULL
BEGIN
    DECLARE @transp_sql NVARCHAR(MAX) = '';
    SELECT @transp_sql += 'ALTER TABLE masters.Transporters ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.Transporters') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'Transporters'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,Name,Phone,Email,Address,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@transp_sql,'')) > 0
    BEGIN
        EXEC(@transp_sql);
        PRINT '  ~ masters.Transporters: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'Name')
BEGIN
    ALTER TABLE masters.Transporters ADD Name NVARCHAR(200) NULL;
    PRINT '  + masters.Transporters.Name';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'Phone')
BEGIN
    ALTER TABLE masters.Transporters ADD Phone NVARCHAR(20) NULL;
    PRINT '  + masters.Transporters.Phone';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'Email')
BEGIN
    ALTER TABLE masters.Transporters ADD Email NVARCHAR(200) NULL;
    PRINT '  + masters.Transporters.Email';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'Address')
BEGIN
    ALTER TABLE masters.Transporters ADD Address NVARCHAR(500) NULL;
    PRINT '  + masters.Transporters.Address';
END
GO

-- ============================================================
-- 11. masters.TransporterVehicles  — nullify legacy columns + add new ones
-- ============================================================
IF OBJECT_ID('masters.TransporterVehicles', 'U') IS NOT NULL
BEGIN
    DECLARE @tv_sql NVARCHAR(MAX) = '';
    SELECT @tv_sql += 'ALTER TABLE masters.TransporterVehicles ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.TransporterVehicles') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'TransporterVehicles'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,TransporterId,VehicleType,Capacity,CapacityUnit,FreightRate,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@tv_sql,'')) > 0
    BEGIN
        EXEC(@tv_sql);
        PRINT '  ~ masters.TransporterVehicles: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.TransporterVehicles') AND name = 'VehicleType')
BEGIN
    ALTER TABLE masters.TransporterVehicles ADD VehicleType NVARCHAR(50) NULL;
    PRINT '  + masters.TransporterVehicles.VehicleType';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.TransporterVehicles') AND name = 'Capacity')
BEGIN
    ALTER TABLE masters.TransporterVehicles ADD Capacity DECIMAL(10,2) NULL;
    PRINT '  + masters.TransporterVehicles.Capacity';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.TransporterVehicles') AND name = 'CapacityUnit')
BEGIN
    ALTER TABLE masters.TransporterVehicles ADD CapacityUnit NVARCHAR(20) NULL;
    PRINT '  + masters.TransporterVehicles.CapacityUnit';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.TransporterVehicles') AND name = 'FreightRate')
BEGIN
    ALTER TABLE masters.TransporterVehicles ADD FreightRate DECIMAL(18,4) NULL;
    PRINT '  + masters.TransporterVehicles.FreightRate';
END
GO

-- ============================================================
-- 12. masters.Materials  — nullify any legacy NOT NULL columns
--    (e.g. old 'Name' column if the DB was created from an older schema)
-- ============================================================
IF OBJECT_ID('masters.Materials', 'U') IS NOT NULL
BEGIN
    DECLARE @mat_sql NVARCHAR(MAX) = '';
    SELECT @mat_sql += 'ALTER TABLE masters.Materials ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.Materials') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'Materials'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,Code,MillId,QualityId,ItemTypeId,GSM,SizeLength,SizeWidth,PackingType,SheetsPerPacket,PacketsPerBundle,BundlesPerBox,Description,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@mat_sql,'')) > 0
    BEGIN
        EXEC(@mat_sql);
        PRINT '  ~ masters.Materials: legacy NOT NULL columns made nullable';
    END
END
GO

-- ============================================================
-- 13. masters.Warehouses  — drop legacy unique constraints + nullify old NOT NULL columns
-- ============================================================

-- Drop legacy unique constraint on Code (old schema: Code NOT NULL UNIQUE; current code never provides Code)
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Warehouses_Code' AND parent_object_id = OBJECT_ID('masters.Warehouses'))
BEGIN
    ALTER TABLE masters.Warehouses DROP CONSTRAINT UQ_Warehouses_Code;
    PRINT '  ~ masters.Warehouses: dropped legacy UQ_Warehouses_Code constraint';
END
GO

-- Also drop if it was a plain unique index (not a key constraint)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Warehouses_Code' AND object_id = OBJECT_ID('masters.Warehouses') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_Warehouses_Code ON masters.Warehouses;
    PRINT '  ~ masters.Warehouses: dropped legacy UQ_Warehouses_Code index';
END
GO

IF OBJECT_ID('masters.Warehouses', 'U') IS NOT NULL
BEGIN
    DECLARE @wh_sql NVARCHAR(MAX) = '';
    SELECT @wh_sql += 'ALTER TABLE masters.Warehouses ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.Warehouses') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'Warehouses'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,Unit,Name,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@wh_sql,'')) > 0
    BEGIN
        EXEC(@wh_sql);
        PRINT '  ~ masters.Warehouses: legacy NOT NULL columns made nullable';
    END
END
GO

-- ============================================================
-- 14. masters.StockGroups  — nullify any legacy NOT NULL columns
--     (Code was handled in section 0; this catches any others)
-- ============================================================
IF OBJECT_ID('masters.StockGroups', 'U') IS NOT NULL
BEGIN
    DECLARE @sg2_sql NVARCHAR(MAX) = '';
    SELECT @sg2_sql += 'ALTER TABLE masters.StockGroups ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.StockGroups') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'StockGroups'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,Name,Description,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@sg2_sql,'')) > 0
    BEGIN
        EXEC(@sg2_sql);
        PRINT '  ~ masters.StockGroups: legacy NOT NULL columns made nullable';
    END
END
GO

-- ============================================================
-- 14. masters.StockSubGroups  — nullify legacy NOT NULL columns
--     + ensure IsDeleted exists (used in all JOIN conditions)
-- ============================================================
IF OBJECT_ID('masters.StockSubGroups', 'U') IS NOT NULL
BEGIN
    DECLARE @ssg_sql NVARCHAR(MAX) = '';
    SELECT @ssg_sql += 'ALTER TABLE masters.StockSubGroups ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.StockSubGroups') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'StockSubGroups'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,StockGroupId,Name,CreatedAt,CreatedBy,IsDeleted,') = 0;
    IF LEN(ISNULL(@ssg_sql,'')) > 0
    BEGIN
        EXEC(@ssg_sql);
        PRINT '  ~ masters.StockSubGroups: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.StockSubGroups') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE masters.StockSubGroups ADD IsDeleted BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.StockSubGroups.IsDeleted';
END
GO

-- ============================================================
-- 15. masters.MillUnits  — ensure audit columns exist
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE masters.MillUnits ADD IsDeleted BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.MillUnits.IsDeleted';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'Address')
BEGIN
    ALTER TABLE masters.MillUnits ADD Address NVARCHAR(500) NULL;
    PRINT '  + masters.MillUnits.Address';
END
GO

-- ============================================================
-- 16. masters.MillContacts  — ensure audit columns exist
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE masters.MillContacts ADD IsDeleted BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.MillContacts.IsDeleted';
END
GO

-- ============================================================
-- 17. masters.WarehouseBins  — add missing columns + nullify legacy NOT NULL columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.WarehouseBins') AND name = 'Name')
BEGIN
    ALTER TABLE masters.WarehouseBins ADD Name NVARCHAR(200) NULL;
    PRINT '  + masters.WarehouseBins.Name';
END
GO

IF OBJECT_ID('masters.WarehouseBins', 'U') IS NOT NULL
BEGIN
    DECLARE @wb_sql NVARCHAR(MAX) = '';
    SELECT @wb_sql += 'ALTER TABLE masters.WarehouseBins ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.WarehouseBins') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'WarehouseBins'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,WarehouseId,Name,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@wb_sql,'')) > 0
    BEGIN
        EXEC(@wb_sql);
        PRINT '  ~ masters.WarehouseBins: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.WarehouseBins') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE masters.WarehouseBins ADD IsDeleted BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.WarehouseBins.IsDeleted';
END
GO

-- ============================================================
-- 18. masters.WarehouseRacks  — add missing columns + nullify legacy NOT NULL columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.WarehouseRacks') AND name = 'Name')
BEGIN
    ALTER TABLE masters.WarehouseRacks ADD Name NVARCHAR(200) NULL;
    PRINT '  + masters.WarehouseRacks.Name';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.WarehouseRacks') AND name = 'StackCount')
BEGIN
    ALTER TABLE masters.WarehouseRacks ADD StackCount INT NULL DEFAULT 1;
    PRINT '  + masters.WarehouseRacks.StackCount';
END
GO

IF OBJECT_ID('masters.WarehouseRacks', 'U') IS NOT NULL
BEGIN
    DECLARE @wr_sql NVARCHAR(MAX) = '';
    SELECT @wr_sql += 'ALTER TABLE masters.WarehouseRacks ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.WarehouseRacks') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'WarehouseRacks'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,BinId,Name,StackCount,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@wr_sql,'')) > 0
    BEGIN
        EXEC(@wr_sql);
        PRINT '  ~ masters.WarehouseRacks: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.WarehouseRacks') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE masters.WarehouseRacks ADD IsDeleted BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.WarehouseRacks.IsDeleted';
END
GO

-- ============================================================
-- 19. masters.Rates  — add new columns IF NOT EXISTS
--     (fallback if section 5's DROP+CREATE did not run)
--     Also nullify any old NOT NULL columns that block INSERT.
-- ============================================================
IF OBJECT_ID('masters.Rates', 'U') IS NOT NULL
BEGIN
    DECLARE @rates_sql NVARCHAR(MAX) = '';
    SELECT @rates_sql += 'ALTER TABLE masters.Rates ALTER COLUMN [' + ic.COLUMN_NAME + '] '
        + ic.DATA_TYPE
        + CASE
            WHEN ic.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CASE WHEN ic.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
                                 ELSE CAST(ic.CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(20)) END + ')'
            WHEN ic.DATA_TYPE IN ('decimal','numeric')
                THEN '(' + CAST(ic.NUMERIC_PRECISION AS NVARCHAR(10)) + ',' + CAST(ic.NUMERIC_SCALE AS NVARCHAR(10)) + ')'
            ELSE '' END
        + ' NULL; '
    FROM   INFORMATION_SCHEMA.COLUMNS ic
    JOIN   sys.columns sc ON sc.object_id = OBJECT_ID('masters.Rates') AND sc.name = ic.COLUMN_NAME
    WHERE  ic.TABLE_SCHEMA = 'masters' AND ic.TABLE_NAME = 'Rates'
      AND  sc.is_nullable = 0 AND sc.is_identity = 0 AND sc.default_object_id = 0
      AND  CHARINDEX(',' + ic.COLUMN_NAME + ',',
           ',Id,MQGId,RateType,RateCategory,CustomerId,Rate,EffectiveFrom,IsActive,CreatedAt,CreatedBy,UpdatedAt,UpdatedBy,IsDeleted,DeletedAt,DeletedBy,') = 0;
    IF LEN(ISNULL(@rates_sql,'')) > 0
    BEGIN
        EXEC(@rates_sql);
        PRINT '  ~ masters.Rates: legacy NOT NULL columns made nullable';
    END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'MQGId')
BEGIN
    ALTER TABLE masters.Rates ADD MQGId INT NULL;
    PRINT '  + masters.Rates.MQGId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'RateType')
BEGIN
    ALTER TABLE masters.Rates ADD RateType NVARCHAR(10) NULL;
    PRINT '  + masters.Rates.RateType';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'RateCategory')
BEGIN
    ALTER TABLE masters.Rates ADD RateCategory NVARCHAR(10) NULL;
    PRINT '  + masters.Rates.RateCategory';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'CustomerId')
BEGIN
    ALTER TABLE masters.Rates ADD CustomerId INT NULL;
    PRINT '  + masters.Rates.CustomerId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'Rate')
BEGIN
    ALTER TABLE masters.Rates ADD [Rate] DECIMAL(18,4) NULL;
    PRINT '  + masters.Rates.Rate';
END
GO

-- ============================================================
-- 25. Create masters.HsnCodes table
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = 'masters' AND t.name = 'HsnCodes')
BEGIN
    CREATE TABLE masters.HsnCodes (
        Id          INT            IDENTITY(1,1) PRIMARY KEY,
        Code        NVARCHAR(20)   NOT NULL,
        Description NVARCHAR(200)  NULL,
        GstPercent  DECIMAL(5,2)   NOT NULL DEFAULT 0,
        IsActive    BIT            NOT NULL DEFAULT 1,
        IsDeleted   BIT            NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy   NVARCHAR(100)  NULL,
        UpdatedAt   DATETIME2      NULL,
        UpdatedBy   NVARCHAR(100)  NULL,
        DeletedAt   DATETIME2      NULL,
        DeletedBy   NVARCHAR(100)  NULL,
        CONSTRAINT UQ_HsnCodes_Code UNIQUE (Code)
    );
    PRINT '  + masters.HsnCodes table created';
END
GO

-- ============================================================
-- 26. Add HsnCodeId and Grain columns to masters.Materials
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'HsnCodeId')
BEGIN
    ALTER TABLE masters.Materials ADD HsnCodeId INT NULL;
    PRINT '  + masters.Materials.HsnCodeId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Materials') AND name = 'Grain')
BEGIN
    ALTER TABLE masters.Materials ADD Grain NVARCHAR(20) NULL;
    PRINT '  + masters.Materials.Grain';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'EffectiveFrom')
BEGIN
    ALTER TABLE masters.Rates ADD EffectiveFrom DATE NULL;
    PRINT '  + masters.Rates.EffectiveFrom';
END
GO

-- ============================================================
-- 20. masters.StockSubGroups  — add Alias column
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.StockSubGroups') AND name = 'Alias')
BEGIN
    ALTER TABLE masters.StockSubGroups ADD Alias NVARCHAR(200) NULL;
    PRINT '  + masters.StockSubGroups.Alias';
END
GO

-- ============================================================
-- 21. masters.Rates  — add Discount column
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Rates') AND name = 'Discount')
BEGIN
    ALTER TABLE masters.Rates ADD Discount DECIMAL(18,4) NULL;
    PRINT '  + masters.Rates.Discount';
END
GO

-- ============================================================
-- 22. masters.Transporters  — drop legacy UQ_Transporters_Code
--     (old schema: Code NOT NULL UNIQUE; current code never provides
--      Code, so NULL values collide on INSERT)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_Transporters_Code' AND parent_object_id = OBJECT_ID('masters.Transporters'))
BEGIN
    ALTER TABLE masters.Transporters DROP CONSTRAINT UQ_Transporters_Code;
    PRINT '  ~ masters.Transporters: dropped legacy UQ_Transporters_Code constraint';
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'UQ_Transporters_Code' AND object_id = OBJECT_ID('masters.Transporters') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_Transporters_Code ON masters.Transporters;
    PRINT '  ~ masters.Transporters: dropped legacy UQ_Transporters_Code index';
END
GO

-- ============================================================
-- 23. masters.Transporters  — add GstNo, PanNo, TdsPercent columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'GstNo')
BEGIN
    ALTER TABLE masters.Transporters ADD GstNo NVARCHAR(20) NULL;
    PRINT '  + masters.Transporters.GstNo';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'PanNo')
BEGIN
    ALTER TABLE masters.Transporters ADD PanNo NVARCHAR(20) NULL;
    PRINT '  + masters.Transporters.PanNo';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Transporters') AND name = 'TdsPercent')
BEGIN
    ALTER TABLE masters.Transporters ADD TdsPercent DECIMAL(5,2) NULL;
    PRINT '  + masters.Transporters.TdsPercent';
END
GO

-- ============================================================
-- 24. masters.Customers  — drop legacy UQ_Customers_Code
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_Customers_Code' AND parent_object_id = OBJECT_ID('masters.Customers'))
BEGIN
    ALTER TABLE masters.Customers DROP CONSTRAINT UQ_Customers_Code;
    PRINT '  ~ masters.Customers: dropped legacy UQ_Customers_Code constraint';
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'UQ_Customers_Code' AND object_id = OBJECT_ID('masters.Customers') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_Customers_Code ON masters.Customers;
    PRINT '  ~ masters.Customers: dropped legacy UQ_Customers_Code index';
END
GO

-- ============================================================
-- 27. masters.Mills  — add IsActive column
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Mills') AND name = 'IsActive')
BEGIN
    ALTER TABLE masters.Mills ADD IsActive BIT NOT NULL DEFAULT 1;
    PRINT '  + masters.Mills.IsActive';
END
GO

-- ============================================================
-- 28. masters.MillUnits  — create if missing, patch columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = 'masters' AND t.name = 'MillUnits')
BEGIN
    CREATE TABLE masters.MillUnits (
        Id          INT            IDENTITY(1,1) PRIMARY KEY,
        MillId      INT            NOT NULL,
        UnitName    NVARCHAR(200)  NOT NULL,
        Address     NVARCHAR(500)  NULL,
        IsActive    BIT            NOT NULL DEFAULT 1,
        IsDeleted   BIT            NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy   NVARCHAR(100)  NULL,
        CONSTRAINT FK_MillUnits_Mill FOREIGN KEY (MillId) REFERENCES masters.Mills(Id)
    );
    PRINT '  + masters.MillUnits table created';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'MillId')
        ALTER TABLE masters.MillUnits ADD MillId INT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'UnitName')
        ALTER TABLE masters.MillUnits ADD UnitName NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'IsActive')
        ALTER TABLE masters.MillUnits ADD IsActive BIT NOT NULL DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'CreatedAt')
        ALTER TABLE masters.MillUnits ADD CreatedAt DATETIME2 NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillUnits') AND name = 'CreatedBy')
        ALTER TABLE masters.MillUnits ADD CreatedBy NVARCHAR(100) NULL;
    PRINT '  ~ masters.MillUnits patched';
END
GO

-- ============================================================
-- 29. masters.MillContacts  — create if missing, patch columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = 'masters' AND t.name = 'MillContacts')
BEGIN
    CREATE TABLE masters.MillContacts (
        Id            INT            IDENTITY(1,1) PRIMARY KEY,
        MillUnitId    INT            NOT NULL,
        ContactPerson NVARCHAR(200)  NOT NULL,
        Designation   NVARCHAR(200)  NULL,
        Phone         NVARCHAR(20)   NULL,
        Email         NVARCHAR(200)  NULL,
        IsActive      BIT            NOT NULL DEFAULT 1,
        IsDeleted     BIT            NOT NULL DEFAULT 0,
        CreatedAt     DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy     NVARCHAR(100)  NULL,
        CONSTRAINT FK_MillContacts_Unit FOREIGN KEY (MillUnitId) REFERENCES masters.MillUnits(Id)
    );
    PRINT '  + masters.MillContacts table created';
END
ELSE
BEGIN
    -- Make legacy NOT NULL columns nullable so they don't block INSERTs
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'MillId' AND is_nullable = 0)
        ALTER TABLE masters.MillContacts ALTER COLUMN MillId INT NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'Name' AND is_nullable = 0)
        ALTER TABLE masters.MillContacts ALTER COLUMN Name NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'MillUnitId')
        ALTER TABLE masters.MillContacts ADD MillUnitId INT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'ContactPerson')
        ALTER TABLE masters.MillContacts ADD ContactPerson NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'Designation')
        ALTER TABLE masters.MillContacts ADD Designation NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'Phone')
        ALTER TABLE masters.MillContacts ADD Phone NVARCHAR(20) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'Email')
        ALTER TABLE masters.MillContacts ADD Email NVARCHAR(200) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'IsActive')
        ALTER TABLE masters.MillContacts ADD IsActive BIT NOT NULL DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'CreatedAt')
        ALTER TABLE masters.MillContacts ADD CreatedAt DATETIME2 NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.MillContacts') AND name = 'CreatedBy')
        ALTER TABLE masters.MillContacts ADD CreatedBy NVARCHAR(100) NULL;
    PRINT '  ~ masters.MillContacts patched';
END
GO

-- ============================================================
-- 30. masters.Mills  — add GstNo and PaymentTerms columns
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Mills') AND name = 'GstNo')
BEGIN
    ALTER TABLE masters.Mills ADD GstNo NVARCHAR(20) NULL;
    PRINT '  + masters.Mills.GstNo';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Mills') AND name = 'PaymentTerms')
BEGIN
    ALTER TABLE masters.Mills ADD PaymentTerms NVARCHAR(50) NULL;
    PRINT '  + masters.Mills.PaymentTerms';
END
GO

-- ============================================================
-- system.CompanyConfig  — singleton row for company-wide settings
-- ============================================================
IF OBJECT_ID('system.CompanyConfig', 'U') IS NULL
CREATE TABLE system.CompanyConfig (
    Id                INT           NOT NULL DEFAULT 1,
    InsurancePolicyNo NVARCHAR(200) NULL,
    InsurancePolicyFy NVARCHAR(20)  NULL,   -- e.g. "2025-26"
    InsuranceIssuer   NVARCHAR(200) NULL,
    UpdatedAt         DATETIME2     NULL,
    UpdatedBy         NVARCHAR(100) NULL,
    CONSTRAINT PK_CompanyConfig PRIMARY KEY (Id),
    CONSTRAINT CHK_CompanyConfig_Singleton CHECK (Id = 1)
);
GO
PRINT '  + system.CompanyConfig';
GO

-- masters.Localities — from migration 006
IF OBJECT_ID('masters.Localities', 'U') IS NULL
CREATE TABLE masters.Localities (
    Id          INT           IDENTITY(1,1) NOT NULL,
    Name        NVARCHAR(150) NOT NULL,
    City        NVARCHAR(100) NULL,
    State       NVARCHAR(100) NULL,
    Description NVARCHAR(500) NULL,
    IsActive    BIT           NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100) NOT NULL DEFAULT 'system',
    UpdatedAt   DATETIME2     NULL,
    UpdatedBy   NVARCHAR(100) NULL,
    IsDeleted   BIT           NOT NULL DEFAULT 0,
    DeletedAt   DATETIME2     NULL,
    DeletedBy   NVARCHAR(100) NULL,
    CONSTRAINT PK_Localities PRIMARY KEY (Id)
);
GO

-- masters.Instructions — from migration 006
IF OBJECT_ID('masters.Instructions', 'U') IS NULL
CREATE TABLE masters.Instructions (
    Id           INT              IDENTITY(1,1) NOT NULL,
    Title        NVARCHAR(200)    NULL,
    ApplicableTo NVARCHAR(10)     NOT NULL DEFAULT 'All',
    LinesJson    NVARCHAR(MAX)    NOT NULL DEFAULT '[]',
    IsActive     BIT              NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy    NVARCHAR(100)    NOT NULL DEFAULT 'system',
    UpdatedAt    DATETIME2        NULL,
    UpdatedBy    NVARCHAR(100)    NULL,
    IsDeleted    BIT              NOT NULL DEFAULT 0,
    DeletedAt    DATETIME2        NULL,
    DeletedBy    NVARCHAR(100)    NULL,
    CONSTRAINT PK_Instructions PRIMARY KEY (Id)
);
GO

IF OBJECT_ID('masters.InstructionMills', 'U') IS NULL
CREATE TABLE masters.InstructionMills (
    InstructionId INT NOT NULL,
    MillId        INT NOT NULL,
    CONSTRAINT PK_InstructionMills PRIMARY KEY (InstructionId, MillId),
    CONSTRAINT FK_InstructionMills_Instruction FOREIGN KEY (InstructionId)
        REFERENCES masters.Instructions(Id) ON DELETE CASCADE
);
GO

-- masters.Customers — LocalityId FK (optional, add only if column missing)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'LocalityId')
BEGIN
    ALTER TABLE masters.Customers ADD LocalityId INT NULL;
    PRINT '  + masters.Customers.LocalityId';
END
GO

-- masters.Customers — PaymentTerms
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('masters.Customers') AND name = 'PaymentTerms')
BEGIN
    ALTER TABLE masters.Customers ADD PaymentTerms NVARCHAR(100) NULL;
    PRINT '  + masters.Customers.PaymentTerms';
END
GO

PRINT '── Migration complete. ──────────────────────────────────';
GO
