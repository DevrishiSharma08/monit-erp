-- Run each block below directly against MonitAssociatesDB (SSMS or sqlcmd).
-- If either throws a real SQL error, that's the exact root cause — copy the
-- error message back. If both run fine with no error, the bug is in .NET
-- code (not SQL), and we need the server-side exception from the live log.

-- ── TEST 1: Purchase Orders list query (mirrors PurchaseOrderRepository.PoSelect) ──
SELECT TOP 50
    po.Id,
    po.PONumber,
    po.MillId,
    ISNULL(m.Name, '')  AS MillName,
    ISNULL(m.Code, '')  AS MillCode,
    CASE WHEN po.MillUnitId IS NOT NULL THEN mu.GstNo ELSE
        ISNULL(
            (SELECT TOP 1 mu2.GstNo FROM masters.MillUnits mu2
             WHERE mu2.MillId = po.MillId AND mu2.IsDeleted = 0 AND mu2.GstNo IS NOT NULL
             ORDER BY mu2.IsDefault DESC, mu2.Id),
            m.GstNo)
    END                                                  AS MillGstNo,
    po.MillUnitId,
    mu.UnitName                                         AS MillUnitName,
    CASE WHEN po.MillUnitId IS NOT NULL THEN mu.Address ELSE
        (SELECT TOP 1 mu3.Address FROM masters.MillUnits mu3
         WHERE mu3.MillId = po.MillId AND mu3.IsDeleted = 0 AND mu3.Address IS NOT NULL
         ORDER BY mu3.IsDefault DESC, mu3.Id)
    END                                                  AS MillUnitAddress,
    po.InsurancePolicyNo,
    po.IsBackfilled,
    po.CancelReason
FROM   procurement.PurchaseOrders      po
LEFT JOIN masters.Mills                m  ON m.Id  = po.MillId
LEFT JOIN masters.MillUnits            mu ON mu.Id = po.MillUnitId
WHERE  po.IsDeleted = 0
ORDER BY po.Id DESC;
GO

-- ── TEST 2: Mill Tracker list query (mirrors MillTrackerRepository.TrackerSelect) ──
SELECT TOP 50
    mt.Id,
    mt.POId                                                                     AS PoId,
    po.PONumber                                                                 AS PoNumber,
    mt.MillId,
    mil.Name                                                                    AS Mill,
    ssg.Name                                                                    AS BrandName,
    CASE WHEN po.MillUnitId IS NOT NULL THEN muu.Address ELSE
        (SELECT TOP 1 mu.Address
         FROM   masters.MillUnits mu
         WHERE  mu.MillId = mt.MillId AND mu.IsDeleted = 0
         ORDER  BY mu.IsDefault DESC, mu.Id)
    END                                                                AS MillAddress,
    po.MillUnitId,
    muu.UnitName                                                        AS MillUnitName
FROM  procurement.MillTrackers           mt
JOIN  masters.Mills                      mil ON mil.Id  = mt.MillId
LEFT JOIN masters.Materials              mat ON mat.Id  = mt.MaterialId
LEFT JOIN masters.StockSubGroups         ssg ON ssg.Id  = mat.QualityId AND ssg.IsDeleted = 0
LEFT JOIN procurement.PurchaseOrders     po  ON po.Id   = mt.POId  AND po.IsDeleted = 0
LEFT JOIN procurement.PurchaseOrderItems poi ON poi.Id  = mt.POItemId
LEFT JOIN masters.Customers              dc  ON dc.Id   = po.DirectCustomerId
LEFT JOIN sales.SalesOrders              so  ON so.Id   = mt.LinkedSOId
LEFT JOIN masters.Customers              soc ON soc.Id  = so.CustomerId
LEFT JOIN masters.MillUnits              muu ON muu.Id  = po.MillUnitId
WHERE mt.IsDeleted = 0
ORDER BY mt.Id DESC;
GO
