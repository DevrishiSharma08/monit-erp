-- ============================================================
-- FILE : 13_backfill_mill_trackers.sql
-- DESC : Create MillTracker rows for every PurchaseOrderItem
--        that does not already have a tracker.
--        Safe to re-run (idempotent — NOT EXISTS guard).
-- RUN  : After all POs exist in the database.
--        No dependency on migration 12.
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 13: backfill mill tracker rows ─────────────';
GO

INSERT INTO procurement.MillTrackers
    (POId, POItemId, MillId, PODate, MaterialId,
     OrderedQty, ReadyQty, DispatchedQty,
     Rate, TotalAmount,
     ProductionStatus, ProductionProgress,
     ExpectedDelivery, LinkedSOId, DeliveryMode,
     CustomerName, CustomerId,                                                                                                                                                      
     Remarks,
     CreatedAt, CreatedBy)
SELECT
    poi.POId,
    poi.Id                                          AS POItemId,
    po.MillId,
    po.OrderDate                                    AS PODate,
    NULLIF(poi.MaterialId, 0)                       AS MaterialId,
    poi.Quantity                                        AS OrderedQty,
    0                                               AS ReadyQty,
    0                                               AS DispatchedQty,
    ISNULL(poi.Rate,   0)                           AS Rate,
    ISNULL(poi.Amount, 0)                           AS TotalAmount,
    'Order Placed'                                  AS ProductionStatus,
    0                                               AS ProductionProgress,
    po.ExpectedDeliveryDate                         AS ExpectedDelivery,
    po.LinkedSOId,
    po.DeliveryMode,
    dc.Name                                         AS CustomerName,
    po.DirectCustomerId                             AS CustomerId,
    NULL                                            AS Remarks,
    GETUTCDATE()                                    AS CreatedAt,
    'system-backfill'                               AS CreatedBy
FROM procurement.PurchaseOrderItems poi
JOIN procurement.PurchaseOrders po
    ON  po.Id        = poi.POId
    AND po.IsDeleted = 0
LEFT JOIN masters.Customers dc
    ON  dc.Id = po.DirectCustomerId
WHERE poi.IsDeleted   = 0
  AND ISNULL(poi.MaterialId, 0) > 0          -- skip items with no material
  AND NOT EXISTS (
      SELECT 1
      FROM   procurement.MillTrackers mt
      WHERE  mt.POItemId  = poi.Id
        AND  mt.IsDeleted = 0
  );
GO

DECLARE @inserted INT = @@ROWCOUNT;
PRINT '  + Backfilled ' + CAST(@inserted AS NVARCHAR) + ' mill tracker row(s).';
GO

PRINT '── Migration 13 complete. ─────────────────────────────────';
GO
