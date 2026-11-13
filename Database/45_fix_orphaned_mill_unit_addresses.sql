-- ============================================================================
-- FILE : 45_fix_orphaned_mill_unit_addresses.sql
-- DESC : Data repair for the "Mill unit edit orphans historical PO/Tracker/
--        Rate references" bug (fixed in code via MillRepository.ReconcileUnits
--        — units are now updated in place instead of soft-deleted + recreated
--        with a new Id on every Mill save).
--
--        This script does NOT touch that code path. It repairs data that was
--        ALREADY corrupted by the old behaviour: every time a Mill was saved
--        before the fix, ALL its units got soft-deleted and re-inserted under
--        brand-new Ids — so any PO/Tracker/Rate that referenced the OLD Id
--        still reads the OLD (frozen, possibly wrong) Address/GstNo forever,
--        even after the user "corrected" it in Masters (the correction landed
--        on a new row with a new Id that old records never pointed to).
--
--        Fix: for every currently-active unit, copy its Address/GstNo onto
--        every soft-deleted historical unit under the SAME mill with the
--        SAME UnitName — these are the same real-world unit, just old
--        snapshots left behind by the bug. This makes every historical
--        PO/Tracker/Rate reference resolve to the CURRENT correct data
--        immediately (no PO edits, no re-pointing of foreign keys needed —
--        MillUnitAddress/MillGstNo are computed live via JOIN at read time).
--
-- SAFETY
--   • Step 1 is a read-only PREVIEW — review the rows before running Step 2.
--   • Step 2 runs inside a transaction; only COMMITs if you say so.
--   • Only touches masters.MillUnits.Address / GstNo — no other table, no
--     foreign keys, no deletes, nothing structural.
-- ============================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ── STEP 1: PREVIEW — run this first and eyeball the rows ──────────────────
SELECT
    old.Id            AS OrphanedUnitId,
    old.MillId,
    m.Name            AS MillName,
    old.UnitName,
    old.Address       AS OldAddress,
    cur.Address       AS NewAddress,
    old.GstNo         AS OldGstNo,
    cur.GstNo         AS NewGstNo,
    cur.Id            AS CurrentActiveUnitId
FROM masters.MillUnits old
JOIN masters.MillUnits cur
    ON cur.MillId    = old.MillId
   AND cur.UnitName  = old.UnitName
   AND cur.IsDeleted = 0
JOIN masters.Mills m ON m.Id = old.MillId
WHERE old.IsDeleted = 1
  AND (
        ISNULL(old.Address, '') <> ISNULL(cur.Address, '')
     OR ISNULL(old.GstNo, '')   <> ISNULL(cur.GstNo, '')
      )
ORDER BY m.Name, old.UnitName, old.Id;
GO

-- ── STEP 2: APPLY — only run after reviewing Step 1's output ────────────────
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

BEGIN TRANSACTION;

UPDATE old
SET old.Address    = cur.Address,
    old.GstNo      = cur.GstNo,
    old.UpdatedAt  = GETUTCDATE(),
    old.UpdatedBy  = 'DATA-FIX-45'
FROM masters.MillUnits old
JOIN masters.MillUnits cur
    ON cur.MillId    = old.MillId
   AND cur.UnitName  = old.UnitName
   AND cur.IsDeleted = 0
WHERE old.IsDeleted = 1
  AND (
        ISNULL(old.Address, '') <> ISNULL(cur.Address, '')
     OR ISNULL(old.GstNo, '')   <> ISNULL(cur.GstNo, '')
      );

PRINT CONCAT(@@ROWCOUNT, ' orphaned mill-unit row(s) repaired.');

-- Review the row count above, then either:
COMMIT TRANSACTION;
-- or, if something looks wrong instead:
-- ROLLBACK TRANSACTION;
GO
