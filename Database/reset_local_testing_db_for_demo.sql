-- ============================================================================
-- FILE : reset_local_testing_db_for_demo.sql
-- DESC : DESTRUCTIVE - LOCAL DEV ONLY. Wipes ALL data from MonitPaperDB_Testing
--        (the shared local dev DB used by both Company1 + Company2 connection
--        strings in appsettings.Development.json), resets every IDENTITY
--        column to start at 1, reseeds the minimum bootstrap data, and rebrands
--        system.CompanyConfig to "Indus Paper ERP" for a clean client demo.
--
--        Hard-locked to the LOCAL TESTING database only - never run this
--        against MonitPaperDB or MonitAssociatesDB on the live server
--        (160.187.166.14), which already has a live client on it.
--
-- SAFETY
--   Hard-coded to MonitPaperDB_Testing only - aborts if run elsewhere.
--   Requires @CONFIRM_RESET to be set to 'YES-WIPE-ALL-DATA'.
-- ============================================================================

USE MonitPaperDB_Testing;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

DECLARE @CONFIRM_RESET NVARCHAR(50) = 'YES-WIPE-ALL-DATA';

IF DB_NAME() <> N'MonitPaperDB_Testing'
BEGIN
    RAISERROR('ABORT: hard-locked to MonitPaperDB_Testing (local dev only). Currently on %s.', 16, 1, DB_NAME());
    RETURN;
END;

IF ISNULL(@CONFIRM_RESET, '') <> 'YES-WIPE-ALL-DATA'
BEGIN
    PRINT 'SAFETY GUARD: Script did not run. Set @CONFIRM_RESET to YES-WIPE-ALL-DATA.';
    RETURN;
END;

PRINT 'MonitPaperDB_Testing FULL RESET (local demo prep) - starting';
GO

-- 1. Disable every FK constraint
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'ALTER TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ' NOCHECK CONSTRAINT ALL;' + CHAR(13)
FROM   sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0;
EXEC sp_executesql @sql;
PRINT 'STAGE 1 done: FKs disabled';
GO

-- 2. Delete every row from every user table (CompanyConfig preserved, rebranded in stage 5)
SET QUOTED_IDENTIFIER ON;
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'DELETE FROM ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ';' + CHAR(13)
FROM   sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  NOT (s.name = 'system' AND t.name = 'CompanyConfig');
EXEC sp_executesql @sql;
PRINT 'STAGE 2 done: all rows deleted (CompanyConfig kept, rebranded below)';
GO

-- 3. Reseed every IDENTITY column to 0
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'DBCC CHECKIDENT (''' + s.name + '.' + t.name + ''', RESEED, 0) WITH NO_INFOMSGS;' + CHAR(13)
FROM   sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  OBJECTPROPERTY(t.object_id, 'TableHasIdentity') = 1;
EXEC sp_executesql @sql;
PRINT 'STAGE 3 done: IDENTITY columns reseeded - next insert will be Id = 1';
GO

-- 4. Re-enable every FK with CHECK
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'ALTER TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ' WITH CHECK CHECK CONSTRAINT ALL;' + CHAR(13)
FROM   sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0;
EXEC sp_executesql @sql;
PRINT 'STAGE 4 done: FKs re-enabled with WITH CHECK';
GO

-- 5. BOOTSTRAP
PRINT 'Reseeding bootstrap data';
GO

INSERT INTO auth.Roles (Name, Description, Permissions, IsActive, CreatedBy)
VALUES
    ('Admin',             'Full system access', '["*"]', 1, 'SYSTEM'),
    ('Manager',           'All read + create/update. No delete.',
     '["inquiry.*","so.*","po.*","grn.*","stock.*","logistics.*","masters.*","reports.*"]', 1, 'SYSTEM'),
    ('Salesman',          'Manage own inquiries and sales orders.',
     '["inquiry.read","inquiry.write","so.read","so.write","masters.read"]', 1, 'SYSTEM'),
    ('Planner',           'Manage procurement, logistics, and dispatch.',
     '["po.*","mill.*","grn.*","stock.*","logistics.*","masters.read"]', 1, 'SYSTEM'),
    ('Accounts',          'Finance and read-only access to operations.',
     '["finance.*","so.read","po.read","grn.read","masters.read"]', 1, 'SYSTEM'),
    ('Warehouse Manager', 'Manage GRN, stock, and bin locations.',
     '["grn.*","stock.*","binlocations.*","masters.read"]', 1, 'SYSTEM');
PRINT 'STAGE 5a done: 6 default roles inserted';
GO

INSERT INTO auth.Users (Username, Email, Password, Name, RoleId, Role, IsActive, BothCompaniesAccess, CreatedBy)
SELECT 'admin', 'admin@induspaper.com', 'Admin@123', 'System Administrator', r.Id, 'Admin', 1, 1, 'SYSTEM'
FROM   auth.Roles r WHERE r.Name = 'Admin';
PRINT 'STAGE 5b done: Admin user created - username: admin password: Admin@123';
GO

DECLARE @Year INT = YEAR(GETDATE());
INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
VALUES
    ('INQ',  @Year, 0, 'INQ',  4, 'SYSTEM'),
    ('SO',   @Year, 0, 'SO',   4, 'SYSTEM'),
    ('PO',   @Year, 0, 'PO',   4, 'SYSTEM'),
    ('GRN',  @Year, 0, 'GRN',  4, 'SYSTEM'),
    ('TLP',  @Year, 0, 'TLP',  4, 'SYSTEM'),
    ('PP',   @Year, 0, 'PP',   4, 'SYSTEM'),
    ('CHN',  @Year, 0, 'CHN',  4, 'SYSTEM'),
    ('TRK',  @Year, 0, 'TRK',  4, 'SYSTEM'),
    ('MILL', @Year, 0, 'MILL', 4, 'SYSTEM');
PRINT 'STAGE 5c done: Number sequences seeded for current year';
GO

-- Rebrand CompanyConfig for the demo (Id=1 / Id=2 correspond to Company1/Company2)
UPDATE system.CompanyConfig
SET CompanyName    = CASE WHEN Id = 1 THEN 'Indus Paper ERP' ELSE 'Indus Paper ERP - Associates' END,
    SmtpSenderName = 'Indus Paper ERP',
    UpdatedAt      = GETUTCDATE(),
    UpdatedBy      = 'SYSTEM'
WHERE Id IN (1, 2);
PRINT 'STAGE 5d done: CompanyConfig rebranded to Indus Paper ERP';
GO

PRINT 'DONE: MonitPaperDB_Testing has been fully reset for demo.';
PRINT 'Login -> username: admin  password: Admin@123';
GO
