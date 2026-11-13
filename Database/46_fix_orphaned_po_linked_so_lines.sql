-- ============================================================================
-- FILE : 46_fix_orphaned_po_linked_so_lines.sql
-- DESC : Data repair for the "SO line edit orphans PurchaseOrderItems.
--        LinkedSOLineId" bug (fixed in code via SalesOrderRepository.
--        ReconcileLinesAsync — SO lines are now updated in place instead of
--        soft-deleted + recreated with a new Id on every SO save).
--
--        Before that fix, EVERY save of an SO (even one that only touched
--        Remarks or a delivery date — not just Material/GSM/Size) soft-
--        deleted ALL its lines and re-inserted them under brand-new Ids.
--        Any PurchaseOrderItems row raised "Against SO" keeps its
--        LinkedSOLineId pointing at the ORIGINAL (now orphaned) line
--        forever — so anything that resolves a PO item's source SO line via
--        this FK (e.g. the new Order-Placed material/GSM/size edit-lock
--        guard) silently stops finding it after the SO has been edited even
--        once, since the link no longer matches any currently-active line.
--
--        This script re-points every such orphaned link to the CURRENTLY
--        active SO line with the same (SOId, LineNumber) — same
--        conceptual line, just under its latest Id. A filtered unique
--        index already guarantees at most one active line per
--        (SOId, LineNumber), so this is unambiguous.
-- ============================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ── STEP 1: PREVIEW — run this first and eyeball the rows ──────────────────
SELECT
    poi.Id                AS POItemId,
    poi.POId,
    po.PONumber,
    poi.LinkedSOLineId    AS OldSOLineId,
    cur.Id                AS NewSOLineId,
    old.SOId,
    old.LineNumber,
    old.Description        AS OldLineDescription,
    cur.Description        AS CurrentLineDescription
FROM procurement.PurchaseOrderItems poi
JOIN procurement.PurchaseOrders     po  ON po.Id  = poi.POId
JOIN sales.SalesOrderLines          old ON old.Id = poi.LinkedSOLineId AND old.IsDeleted = 1
JOIN sales.SalesOrderLines          cur ON cur.SOId = old.SOId AND cur.LineNumber = old.LineNumber AND cur.IsDeleted = 0
WHERE poi.IsDeleted = 0
ORDER BY po.PONumber, poi.LineNumber;
GO

-- ── STEP 2: APPLY — only run after reviewing Step 1's output ────────────────
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

BEGIN TRANSACTION;

UPDATE poi
SET poi.LinkedSOLineId = cur.Id
FROM procurement.PurchaseOrderItems poi
JOIN sales.SalesOrderLines old ON old.Id = poi.LinkedSOLineId AND old.IsDeleted = 1
JOIN sales.SalesOrderLines cur ON cur.SOId = old.SOId AND cur.LineNumber = old.LineNumber AND cur.IsDeleted = 0
WHERE poi.IsDeleted = 0;

PRINT CONCAT(@@ROWCOUNT, ' PurchaseOrderItems row(s) re-pointed to their current SO line.');

COMMIT TRANSACTION;
-- If something looks wrong instead, replace COMMIT above with ROLLBACK before running.
GO
