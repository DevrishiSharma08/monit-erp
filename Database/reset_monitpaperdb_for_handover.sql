-- ============================================================================
-- FILE : reset_monitpaperdb_for_handover.sql
-- DESC : DESTRUCTIVE — wipes ALL data from MonitPaperDB, resets every IDENTITY
--        column to start at 1, then reseeds the minimum bootstrap data the
--        app needs (roles, admin user, number sequences, company config).
--
--        Run this once before handing the link over to the client. After it
--        runs the DB contains:
--            • 6 default roles
--            • 1 user  (username = admin   password = Admin@123)
--            • Number sequences for the current year
--            • Existing system.CompanyConfig row PRESERVED (SMTP app
--              password / company settings stay intact)
--            • Every other table is empty with IDENTITY reseeded to 1
--
-- HOW IT WORKS
--   1. Disables every FK constraint  (so DELETE can run in any order)
--   2. DELETEs every row from every user table
--   3. Reseeds every IDENTITY column to 0  (next insert => Id = 1)
--   4. Re-enables every FK with CHECK so future inserts are validated
--   5. Reseeds the minimum bootstrap data
--
-- SAFETY
--   • Hard-coded to MonitPaperDB only — will abort if run elsewhere.
--   • Requires @CONFIRM_RESET to be set to 'YES-WIPE-ALL-DATA'
--     (prevents accidental runs).
--   • No transaction wrapper — full reset is intended to be permanent.
--
-- HOW TO RUN  (SSMS)
--   1. Open this file
--   2. Set the confirmation variable below
--   3. Execute (F5)
-- ============================================================================

USE MonitPaperDB;
GO

-- ============================================================================
-- !! SAFETY CONFIRMATION !!
-- Change to 'YES-WIPE-ALL-DATA' to actually run.
-- ============================================================================
DECLARE @CONFIRM_RESET NVARCHAR(50) = 'YES-WIPE-ALL-DATA';

-- Belt-and-braces: also verify we're on the right DB
IF DB_NAME() <> N'MonitPaperDB'
BEGIN
    RAISERROR('ABORT: This script is hard-locked to MonitPaperDB. Currently on %s.', 16, 1, DB_NAME());
    RETURN;
END;

IF ISNULL(@CONFIRM_RESET, '') <> 'YES-WIPE-ALL-DATA'
BEGIN
    PRINT '────────────────────────────────────────────────────────────────';
    PRINT 'SAFETY GUARD: Script did not run.';
    PRINT 'Set @CONFIRM_RESET to ''YES-WIPE-ALL-DATA'' at the top of the';
    PRINT 'script and execute again.';
    PRINT '────────────────────────────────────────────────────────────────';
    RETURN;
END;

PRINT '══════════════════════════════════════════════════════════════';
PRINT '  MonitPaperDB FULL RESET — starting';
PRINT '══════════════════════════════════════════════════════════════';
GO

-- ============================================================================
-- 1.  Disable every foreign key constraint
-- ============================================================================
PRINT '── STAGE 1: Disable all FK constraints ──────────────────────';
GO

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'ALTER TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name)
            +  ' NOCHECK CONSTRAINT ALL;' + CHAR(13)
FROM   sys.tables t
JOIN   sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0;
EXEC sp_executesql @sql;
PRINT '  ✓ FKs disabled';
GO

-- ============================================================================
-- 2.  Delete every row from every user table
--     (system.CompanyConfig is preserved — it holds SMTP app password
--     and other configuration the client doesn't want to re-enter.)
-- ============================================================================
PRINT '── STAGE 2: Delete all data (CompanyConfig preserved) ───────';
GO

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'DELETE FROM ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ';' + CHAR(13)
FROM   sys.tables t
JOIN   sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  NOT (s.name = 'system' AND t.name = 'CompanyConfig');  -- KEEP
EXEC sp_executesql @sql;
PRINT '  ✓ All rows deleted (CompanyConfig kept intact)';
GO

-- ============================================================================
-- 3.  Reseed every IDENTITY column to 0  (next insert ⇒ Id = 1)
-- ============================================================================
PRINT '── STAGE 3: Reset IDENTITY counters ─────────────────────────';
GO

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'DBCC CHECKIDENT (''' + s.name + '.' + t.name + ''', RESEED, 0) WITH NO_INFOMSGS;' + CHAR(13)
FROM   sys.tables t
JOIN   sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  OBJECTPROPERTY(t.object_id, 'TableHasIdentity') = 1;
EXEC sp_executesql @sql;
PRINT '  ✓ IDENTITY columns reseeded — next insert will be Id = 1';
GO

-- ============================================================================
-- 4.  Re-enable every FK with CHECK so future inserts are validated
-- ============================================================================
PRINT '── STAGE 4: Re-enable FK constraints ────────────────────────';
GO

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'ALTER TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name)
            +  ' WITH CHECK CHECK CONSTRAINT ALL;' + CHAR(13)
FROM   sys.tables t
JOIN   sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0;
EXEC sp_executesql @sql;
PRINT '  ✓ FKs re-enabled with WITH CHECK';
GO

-- ============================================================================
-- 5.  BOOTSTRAP — minimum data the app needs to start
-- ============================================================================
PRINT '── STAGE 5: Reseeding bootstrap data ────────────────────────';
GO

-- 5a. Roles
INSERT INTO auth.Roles (Name, Description, Permissions, IsActive, CreatedBy)
VALUES
    ('Admin',             'Full system access',
     '["*"]', 1, 'SYSTEM'),
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
PRINT '  ✓ 6 default roles inserted';
GO

-- 5b. Admin user  (username = admin   password = Admin@123)
INSERT INTO auth.Users (Username, Email, Password, Name, RoleId, Role,
                        IsActive, BothCompaniesAccess, CreatedBy)
SELECT
    'admin',
    'admin@monitpaper.com',
    'Admin@123',                           -- plaintext, matches existing auth flow
    'System Administrator',
    r.Id,
    'Admin',
    1,
    1,                                     -- can access both companies
    'SYSTEM'
FROM   auth.Roles r
WHERE  r.Name = 'Admin';
PRINT '  ✓ Admin user created — username: admin   password: Admin@123';
GO

-- 5c. Number sequences for current year
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
PRINT '  ✓ Number sequences seeded for current year';
GO

-- 5d. CompanyConfig — left untouched on purpose (SMTP app password etc.)

-- ============================================================================
-- DONE
-- ============================================================================
PRINT '';
PRINT '══════════════════════════════════════════════════════════════';
PRINT '  MonitPaperDB has been fully reset.';
PRINT '──────────────────────────────────────────────────────────────';
PRINT '  Login   →  username: admin';
PRINT '            password: Admin@123';
PRINT '  Next Id →  1   (across all tables)';
PRINT '══════════════════════════════════════════════════════════════';
GO
