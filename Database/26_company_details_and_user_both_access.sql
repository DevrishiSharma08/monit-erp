-- ============================================================
-- FILE : 26_company_details_and_user_both_access.sql
-- DESC : 1. Add CompanyName, Address, GstNumber to CompanyConfig
--        2. Add BothCompaniesAccess flag to auth.Users
-- RUN  : On BOTH MonitPaperDB and MonitAssociatesDB
-- ============================================================

USE MonitPaperDB;   -- change to MonitAssociatesDB when running on second DB
GO

-- ── system.CompanyConfig ─────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('system.CompanyConfig') AND name = 'CompanyName')
BEGIN
    ALTER TABLE system.CompanyConfig ADD CompanyName NVARCHAR(100) NULL;
    PRINT '✓ CompanyName added.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('system.CompanyConfig') AND name = 'Address')
BEGIN
    ALTER TABLE system.CompanyConfig ADD Address NVARCHAR(300) NULL;
    PRINT '✓ Address added.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('system.CompanyConfig') AND name = 'GstNumber')
BEGIN
    ALTER TABLE system.CompanyConfig ADD GstNumber NVARCHAR(20) NULL;
    PRINT '✓ GstNumber added.';
END
GO

-- ── auth.Users ────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('auth.Users') AND name = 'BothCompaniesAccess')
BEGIN
    ALTER TABLE auth.Users ADD BothCompaniesAccess BIT NOT NULL DEFAULT 0;
    PRINT '✓ BothCompaniesAccess added to auth.Users.';
END
GO

PRINT 'Migration 26 complete.';
GO
