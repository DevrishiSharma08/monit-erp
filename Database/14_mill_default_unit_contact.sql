-- ============================================================
-- FILE : 14_mill_default_unit_contact.sql
-- DESC : Add IsDefault flag to MillUnits and MillContacts so
--        the PO form can auto-select the default unit & contact.
-- RUN  : After 03_masters_tables.sql
-- Safe to re-run (idempotent).
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 14: mill default unit / contact ───────────────';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('masters.MillUnits') AND name = 'IsDefault'
)
BEGIN
    ALTER TABLE masters.MillUnits ADD IsDefault BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.MillUnits.IsDefault';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('masters.MillContacts') AND name = 'IsDefault'
)
BEGIN
    ALTER TABLE masters.MillContacts ADD IsDefault BIT NOT NULL DEFAULT 0;
    PRINT '  + masters.MillContacts.IsDefault';
END
GO

PRINT '── Migration 14 complete. ─────────────────────────────────';
GO
