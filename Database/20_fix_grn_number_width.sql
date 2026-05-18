-- ============================================================
-- FILE : 20_fix_grn_number_width.sql
-- DESC : Widens inventory.GRNs.GRNNumber from NVARCHAR(20) to
--        NVARCHAR(30) to accommodate the timestamp-based format
--        GRN-{YYYY}-{yyMMddHHmmss}  (e.g. GRN-2026-260518084824 = 21 chars).
-- RUN  : After 19_grn_extras.sql
-- ============================================================

USE MonitPaperDB;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs')
      AND name      = 'GRNNumber'
      AND max_length < 60   -- NVARCHAR(30) stores as 60 bytes; current is 40 (NVARCHAR(20))
)
BEGIN
    ALTER TABLE inventory.GRNs
        ALTER COLUMN GRNNumber NVARCHAR(30) NOT NULL;
    PRINT '  + inventory.GRNs.GRNNumber widened to NVARCHAR(30)';
END
ELSE
BEGIN
    PRINT '  ~ inventory.GRNs.GRNNumber already wide enough — skipped';
END
GO

PRINT '✓ 20_fix_grn_number_width.sql complete.';
GO
