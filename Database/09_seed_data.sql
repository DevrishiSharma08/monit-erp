-- ============================================================
-- FILE : 09_seed_data.sql
-- DESC : Essential seed data required before the app can run.
--        1. Number sequences (one row per document type)
--        2. Default roles
--        3. Default Admin user  (password: Admin@123)
--        4. Sample master data (optional — can be deleted after
--           first login and entering real data via UI)
-- RUN  : After 08_indexes.sql — run last
-- ============================================================

USE MonitPaperDB;
GO

-- ============================================================
-- 1. NUMBER SEQUENCES
-- One row per module per year.
-- App uses UPDLOCK to increment atomically — no duplicates.
-- Add a new row for each new year (or app auto-inserts it).
-- ============================================================

DECLARE @Year INT = YEAR(GETDATE());

INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
SELECT * FROM (VALUES
    ('INQ',  @Year, 0, 'INQ',  4, 'SYSTEM'),   -- INQ-2024-0001
    ('SO',   @Year, 0, 'SO',   4, 'SYSTEM'),   -- SO-2024-0001
    ('PO',   @Year, 0, 'PO',   4, 'SYSTEM'),   -- PO-2024-0001
    ('GRN',  @Year, 0, 'GRN',  4, 'SYSTEM'),   -- GRN-2024-0001
    ('TLP',  @Year, 0, 'TLP',  4, 'SYSTEM'),   -- TLP-2024-0001
    ('PP',   @Year, 0, 'PP',   4, 'SYSTEM'),   -- PP-2024-0001
    ('CHN',  @Year, 0, 'CHN',  4, 'SYSTEM'),   -- CHN-2024-0001
    ('TRK',  @Year, 0, 'TRK',  4, 'SYSTEM'),   -- TRK-2024-0001
    ('MILL', @Year, 0, 'MILL', 4, 'SYSTEM')    -- Mill tracker reference (if needed)
) AS src (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
WHERE NOT EXISTS (
    SELECT 1 FROM system.NumberSequences
    WHERE Module = src.Module AND [Year] = src.[Year]
);
GO

-- Stored procedure: thread-safe number generation
-- Call: EXEC system.usp_GetNextNumber 'SO', @Number OUTPUT
-- Returns: 'SO-2024-0042'
CREATE OR ALTER PROCEDURE system.usp_GetNextNumber
    @Module     NVARCHAR(20),
    @Number     NVARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Year       INT         = YEAR(GETDATE());
    DECLARE @LastNum    INT;
    DECLARE @Padding    INT;
    DECLARE @Prefix     NVARCHAR(10);

    BEGIN TRAN;

        -- Auto-insert sequence row if new year
        IF NOT EXISTS (SELECT 1 FROM system.NumberSequences WHERE Module = @Module AND [Year] = @Year)
        BEGIN
            INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
            SELECT TOP 1 @Module, @Year, 0, Prefix, Padding, 'SYSTEM'
            FROM   system.NumberSequences
            WHERE  Module = @Module
            ORDER  BY [Year] DESC;
        END

        UPDATE system.NumberSequences WITH (UPDLOCK)
        SET    LastNumber = LastNumber + 1,
               UpdatedAt  = GETUTCDATE()
        WHERE  Module = @Module AND [Year] = @Year;

        -- Fetch updated values
        SELECT @LastNum = LastNumber,
               @Prefix  = Prefix,
               @Padding = Padding
        FROM   system.NumberSequences
        WHERE  Module = @Module AND [Year] = @Year;

    COMMIT;

    -- Format: SO-2024-0001
    SET @Number = @Prefix + '-' + CAST(@Year AS NVARCHAR(4))
                  + '-' + RIGHT(REPLICATE('0', @Padding) + CAST(@LastNum AS NVARCHAR(10)), @Padding);
END;
GO

-- ============================================================
-- 2. DEFAULT ROLES
-- ============================================================

INSERT INTO auth.Roles (Name, Description, Permissions, IsActive, CreatedBy)
SELECT * FROM (VALUES
    ('Admin',             'Full system access',
     '["*"]',
     1, 'SYSTEM'),

    ('Manager',           'All read + create/update. No delete.',
     '["inquiry.*","so.*","po.*","grn.*","stock.*","logistics.*","masters.*","reports.*"]',
     1, 'SYSTEM'),

    ('Salesman',          'Manage own inquiries and sales orders.',
     '["inquiry.read","inquiry.write","so.read","so.write","masters.read"]',
     1, 'SYSTEM'),

    ('Planner',           'Manage procurement, logistics, and dispatch.',
     '["po.*","mill.*","grn.*","stock.*","logistics.*","masters.read"]',
     1, 'SYSTEM'),

    ('Accounts',          'Finance and read-only access to operations.',
     '["finance.*","so.read","po.read","grn.read","masters.read"]',
     1, 'SYSTEM'),

    ('Warehouse Manager', 'Manage GRN, stock, and bin locations.',
     '["grn.*","stock.*","binlocations.*","masters.read"]',
     1, 'SYSTEM')
) AS src (Name, Description, Permissions, IsActive, CreatedBy)
WHERE NOT EXISTS (SELECT 1 FROM auth.Roles WHERE Name = src.Name);
GO

-- ============================================================
-- 3. DEFAULT ADMIN USER
-- Username : admin
-- Password : Admin@123
-- ============================================================

INSERT INTO auth.Users (Username, Email, Password, Name, RoleId, Role, IsActive, CreatedBy)
SELECT
    'admin',
    'admin@monitpaper.com',
    'Admin@123',
    'System Administrator',
    r.Id,
    'Admin',
    1,
    'SYSTEM'
FROM auth.Roles r
WHERE r.Name = 'Admin'
  AND NOT EXISTS (SELECT 1 FROM auth.Users WHERE Username = 'admin');
GO

-- ============================================================
-- 4. SAMPLE MASTER DATA (optional — for dev/testing)
-- Remove this section before going live if entering real data
-- ============================================================

-- Sample warehouse
INSERT INTO masters.Warehouses (Code, Name, Address, City, Manager, Phone, IsActive, CreatedBy)
SELECT 'WH-01', 'Main Godown', 'Ring Road, Indore', 'Indore', 'Warehouse Manager', '9999900000', 1, 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM masters.Warehouses WHERE Code = 'WH-01');
GO

-- Sample stock group
INSERT INTO masters.StockGroups (Code, Name, Description, IsActive, CreatedBy)
SELECT 'PG', 'Printing & Writing', 'Printing and writing grade papers', 1, 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM masters.StockGroups WHERE Code = 'PG');
GO

-- Sample stock category
INSERT INTO masters.StockCategories (StockGroupId, Code, Name, IsActive, CreatedBy)
SELECT sg.Id, 'MAP', 'Maplitho', 1, 'SYSTEM'
FROM   masters.StockGroups sg
WHERE  sg.Code = 'PG'
  AND  NOT EXISTS (SELECT 1 FROM masters.StockCategories WHERE Code = 'MAP');
GO

-- Sample item type
INSERT INTO masters.ItemTypes (Code, Name, Description, IsActive, CreatedBy)
SELECT 'REAM', 'Ream', '500 sheets per ream', 1, 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM masters.ItemTypes WHERE Code = 'REAM');
GO

-- Sample paper sizes
INSERT INTO masters.PaperSizes (Label, WidthMM, HeightMM, IsCustom, SortOrder, IsActive, CreatedBy)
SELECT * FROM (VALUES
    ('23x36',   584,  914, 0, 1, 1, 'SYSTEM'),
    ('24x36',   610,  914, 0, 2, 1, 'SYSTEM'),
    ('22x30',   559,  762, 0, 3, 1, 'SYSTEM'),
    ('A4',      210,  297, 0, 4, 1, 'SYSTEM'),
    ('A3',      297,  420, 0, 5, 1, 'SYSTEM')
) AS src (Label, WidthMM, HeightMM, IsCustom, SortOrder, IsActive, CreatedBy)
WHERE NOT EXISTS (SELECT 1 FROM masters.PaperSizes WHERE Label = src.Label);
GO

PRINT '✓ Seed data inserted.';
PRINT '';
PRINT '=== DATABASE SETUP COMPLETE ===';
PRINT 'Default login → Username: admin  Password: Admin@123';
PRINT 'Change password on first login.';
GO
