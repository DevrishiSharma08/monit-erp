-- ============================================================
-- FILE : 15_customer_contact_is_default.sql
-- DESC : Add IsDefault flag to CustomerContacts so the SO form
--        can auto-select the default contact per customer.
-- RUN  : After 03_masters_tables.sql
-- Safe to re-run (idempotent).
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 15: customer contact IsDefault ─────────────────';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('masters.CustomerContacts') AND name = 'IsDefault'
)
BEGIN
    ALTER TABLE masters.CustomerContacts ADD IsDefault BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.CustomerContacts.IsDefault';
END
GO

PRINT '── Migration 15 complete. ─────────────────────────────────';
GO
