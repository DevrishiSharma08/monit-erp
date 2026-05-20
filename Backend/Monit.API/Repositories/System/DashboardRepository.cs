using Dapper;
using Monit.API.Data;
using Monit.API.Models.DTOs.Dashboard;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Dash;

public class DashboardRepository(DbConnectionFactory db) : IDashboardRepository
{
    public async Task<DashboardSummaryDto> GetSummaryAsync()
    {
        const string sql = @"
            -- 1. KPIs
            SELECT
                (SELECT COUNT(*) FROM sales.SalesOrders
                 WHERE Status NOT IN ('Completed','Closed','Cancelled') AND IsDeleted=0)    AS OpenSoCount,
                ISNULL((SELECT SUM(TotalValue) FROM sales.SalesOrders
                 WHERE Status NOT IN ('Completed','Closed','Cancelled') AND IsDeleted=0),0) AS OpenSoValue,
                (SELECT COUNT(*) FROM procurement.PurchaseOrders
                 WHERE Status NOT IN ('Received','Cancelled') AND IsDeleted=0)              AS OpenPoCount,
                ISNULL((SELECT SUM(TotalValue) FROM procurement.PurchaseOrders
                 WHERE Status NOT IN ('Received','Cancelled') AND IsDeleted=0),0)           AS OpenPoValue,
                (
                  -- Existing GRNs not yet fully processed
                  (SELECT COUNT(*) FROM inventory.GRNs
                   WHERE Status NOT IN ('Stock Updated') AND IsDeleted=0)
                  +
                  -- In-Transit TLPs that have no GRN created yet
                  (SELECT COUNT(*) FROM procurement.TruckLoadPlans tlp
                   WHERE tlp.Status = 'In Transit' AND tlp.IsDeleted = 0
                     AND NOT EXISTS (
                       SELECT 1 FROM inventory.GRNs g
                       WHERE g.SourceLoadPlanId = tlp.Id AND g.IsDeleted = 0
                     ))
                )                                                                           AS PendingGrnCount,
                (SELECT COUNT(*) FROM inventory.StockLots
                 WHERE Status='Available' AND IsDeleted=0)                                  AS AvailableStockLots,
                ISNULL((SELECT SUM(CurrentQty) FROM inventory.StockLots
                 WHERE Status='Available' AND IsDeleted=0),0)                               AS AvailableStockQty,
                (SELECT COUNT(*) FROM procurement.MillTrackers WHERE IsDeleted=0)           AS MillTrackerTotal,
                (SELECT COUNT(*) FROM procurement.MillTrackers
                 WHERE ProductionStatus IN ('Ready','Dispatched') AND IsDeleted=0)          AS MillTrackerReady;

            -- 2. Recent Sales Orders (6)
            SELECT TOP 6
                so.Id,
                so.SONumber                                    AS Number,
                ISNULL(c.Name, '')                             AS Party,
                so.Status,
                so.TotalValue,
                CONVERT(varchar(10), so.OrderDate, 120)        AS OrderDate
            FROM  sales.SalesOrders   so
            LEFT JOIN masters.Customers c ON c.Id = so.CustomerId
            WHERE so.IsDeleted = 0
            ORDER BY so.CreatedAt DESC;

            -- 3. Recent Purchase Orders (6)
            SELECT TOP 6
                po.Id,
                po.PONumber                                    AS Number,
                ISNULL(m.Name, '')                             AS Party,
                po.Status,
                po.TotalValue,
                CONVERT(varchar(10), po.OrderDate, 120)        AS OrderDate
            FROM  procurement.PurchaseOrders po
            LEFT JOIN masters.Mills m ON m.Id = po.MillId
            WHERE po.IsDeleted = 0
            ORDER BY po.CreatedAt DESC;

            -- 4. Mill Trackers (6)
            SELECT TOP 6
                mt.Id,
                ISNULL(mt.Description, '')                     AS Material,
                ISNULL(mm.Name, '')                            AS Mill,
                mt.OrderedQty,
                mt.ProductionStatus,
                ISNULL(mt.ProductionProgress, 0)               AS ProductionProgress
            FROM  procurement.MillTrackers mt
            LEFT JOIN masters.Mills mm ON mm.Id = mt.MillId
            WHERE mt.IsDeleted = 0
            ORDER BY mt.CreatedAt DESC;

            -- 5. SO Status Breakdown
            SELECT Status AS Name, COUNT(*) AS Value
            FROM  sales.SalesOrders WHERE IsDeleted = 0
            GROUP BY Status ORDER BY Value DESC;

            -- 6. PO Status Breakdown
            SELECT Status AS Name, COUNT(*) AS Value
            FROM  procurement.PurchaseOrders WHERE IsDeleted = 0
            GROUP BY Status ORDER BY Value DESC;
        ";

        using var conn  = db.Create();
        using var multi = await conn.QueryMultipleAsync(sql);

        var kpis       = await multi.ReadFirstAsync<DashboardKpiRow>();
        var recentSOs  = (await multi.ReadAsync<DashboardOrderRow>()).ToList();
        var recentPOs  = (await multi.ReadAsync<DashboardOrderRow>()).ToList();
        var milltracks = (await multi.ReadAsync<DashboardMillTrackerRow>()).ToList();
        var soStatus   = (await multi.ReadAsync<DashboardStatusItem>()).ToList();
        var poStatus   = (await multi.ReadAsync<DashboardStatusItem>()).ToList();

        return new DashboardSummaryDto
        {
            OpenSoCount          = kpis.OpenSoCount,
            OpenSoValue          = kpis.OpenSoValue,
            OpenPoCount          = kpis.OpenPoCount,
            OpenPoValue          = kpis.OpenPoValue,
            PendingGrnCount      = kpis.PendingGrnCount,
            AvailableStockLots   = kpis.AvailableStockLots,
            AvailableStockQty    = kpis.AvailableStockQty,
            MillTrackerTotal     = kpis.MillTrackerTotal,
            MillTrackerReady     = kpis.MillTrackerReady,
            RecentSalesOrders    = recentSOs,
            RecentPurchaseOrders = recentPOs,
            MillTrackers         = milltracks,
            SoStatusBreakdown    = soStatus,
            PoStatusBreakdown    = poStatus,
        };
    }

    private class DashboardKpiRow
    {
        public int     OpenSoCount        { get; set; }
        public decimal OpenSoValue        { get; set; }
        public int     OpenPoCount        { get; set; }
        public decimal OpenPoValue        { get; set; }
        public int     PendingGrnCount    { get; set; }
        public int     AvailableStockLots { get; set; }
        public decimal AvailableStockQty  { get; set; }
        public int     MillTrackerTotal   { get; set; }
        public int     MillTrackerReady   { get; set; }
    }
}
