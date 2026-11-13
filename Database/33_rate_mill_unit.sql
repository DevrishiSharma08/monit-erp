-- ============================================================================
-- FILE : 33_rate_mill_unit.sql
-- DESC : Adds MillUnitId (NULL) to masters.Rates so purchase rates can vary by
--        mill unit. A NULL MillUnitId means the rate applies to the mill as
--        a whole (legacy / mill-level rate). When mill unit-specific rates
--        exist, lookups should prefer those over the NULL row.
--
-- RUN  : Anytime — idempotent. Safe to re-run.
-- ============================================================================

PRINT '── Migration 33: MillUnitId on masters.Rates ─────────────────';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('masters.Rates')
                 AND name = 'MillUnitId')
BEGIN
    ALTER TABLE masters.Rates
        ADD MillUnitId INT NULL
            CONSTRAINT FK_Rates_MillUnit
                FOREIGN KEY REFERENCES masters.MillUnits(Id);
    PRINT '  + MillUnitId → masters.Rates';
END
ELSE
BEGIN
    PRINT '  ✓ MillUnitId already present on masters.Rates — skipped';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_Rates_MillUnitId'
                 AND object_id = OBJECT_ID('masters.Rates'))
BEGIN
    CREATE INDEX IX_Rates_MillUnitId
        ON masters.Rates (MillUnitId)
        WHERE MillUnitId IS NOT NULL AND IsDeleted = 0;
    PRINT '  + IX_Rates_MillUnitId';
END
GO

PRINT '── Migration 33 complete. ──────────────────────────────────';
GO
