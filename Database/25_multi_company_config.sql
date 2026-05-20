-- ============================================================
-- FILE : 25_multi_company_config.sql
-- DESC : Add CompanyName column to system.CompanyConfig and
--        insert a second company row for Monit Paper Associates.
-- RUN  : After 24_notifications_and_permissions.sql
-- ============================================================

USE MonitPaperDB;
GO

-- Add CompanyName column if it doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('system.CompanyConfig') AND name = 'CompanyName'
)
BEGIN
    ALTER TABLE system.CompanyConfig ADD CompanyName NVARCHAR(100) NULL;
    PRINT '✓ CompanyName column added to system.CompanyConfig.';
END
ELSE
    PRINT '  CompanyName column already exists — skipped.';
GO

-- Set name for existing row (Id = 1)
UPDATE system.CompanyConfig SET CompanyName = 'Monit Paper Agency' WHERE Id = 1;
PRINT '✓ Monit Paper Agency name set for Id = 1.';
GO

-- Drop singleton check constraint if it exists
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CHK_CompanyConfig_Singleton'
      AND parent_object_id = OBJECT_ID('system.CompanyConfig')
)
BEGIN
    ALTER TABLE system.CompanyConfig DROP CONSTRAINT CHK_CompanyConfig_Singleton;
    PRINT '✓ Singleton constraint dropped.';
END
ELSE
    PRINT '  CHK_CompanyConfig_Singleton not found — skipped.';
GO

-- Insert second company if not already present
IF NOT EXISTS (SELECT 1 FROM system.CompanyConfig WHERE Id = 2)
BEGIN
    INSERT INTO system.CompanyConfig (Id, CompanyName) VALUES (2, 'Monit Paper Associates');
    PRINT '✓ Monit Paper Associates row inserted (Id = 2).';
END
ELSE
    PRINT '  Id = 2 already exists — skipped.';
GO
