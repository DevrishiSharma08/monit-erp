using Dapper;
using Monit.API.Data;
using Monit.API.Models.DTOs.Notif;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Notifications;

public class NotificationRepository(DbConnectionFactory db) : INotificationRepository
{
    private const string LiveQuery = @"
        -- Sales Orders needing attention
        SELECT
            'SO-' + CAST(so.Id AS NVARCHAR(10))           AS [Key],
            'SO'                                           AS [Type],
            'Sales Order Alert'                            AS Title,
            so.Status + ' — ' + ISNULL(c.Name, '')        AS Body,
            so.SONumber                                    AS RefNumber,
            '/orders'                                      AS Href,
            ISNULL(ns.IsRead, 0)                           AS IsRead,
            CONVERT(NVARCHAR(30), ISNULL(so.UpdatedAt, so.CreatedAt), 126) AS NotifTs
        FROM  sales.SalesOrders so
        LEFT JOIN masters.Customers c ON c.Id = so.CustomerId
        LEFT JOIN system.NotificationState ns
               ON ns.NotifKey = 'SO-' + CAST(so.Id AS NVARCHAR(10)) AND ns.UserId = @UserId
        WHERE so.IsDeleted = 0
          AND so.Status IN ('Approval Pending','Draft','Pending Allocation','Partially Allocated')
          AND ISNULL(ns.IsDismissed, 0) = 0

        UNION ALL

        -- Purchase Orders needing attention
        SELECT
            'PO-' + CAST(po.Id AS NVARCHAR(10))           AS [Key],
            'PO'                                           AS [Type],
            'Purchase Order Update'                        AS Title,
            po.Status + ' — ' + ISNULL(m.Name, '')        AS Body,
            po.PONumber                                    AS RefNumber,
            '/purchase-orders'                             AS Href,
            ISNULL(ns.IsRead, 0)                           AS IsRead,
            CONVERT(NVARCHAR(30), ISNULL(po.UpdatedAt, po.CreatedAt), 126) AS NotifTs
        FROM  procurement.PurchaseOrders po
        LEFT JOIN masters.Mills m ON m.Id = po.MillId
        LEFT JOIN system.NotificationState ns
               ON ns.NotifKey = 'PO-' + CAST(po.Id AS NVARCHAR(10)) AND ns.UserId = @UserId
        WHERE po.IsDeleted = 0
          AND po.Status IN ('Approval Pending','Sent to Mill','In Production','Partial Ready','Acknowledged')
          AND ISNULL(ns.IsDismissed, 0) = 0

        UNION ALL

        -- GRNs pending QC / approval
        SELECT
            'GRN-' + CAST(g.Id AS NVARCHAR(10))           AS [Key],
            'GRN'                                          AS [Type],
            'GRN Pending Action'                           AS Title,
            g.Status + ' — ' + ISNULL(mil.Name, '')       AS Body,
            g.GRNNumber                                    AS RefNumber,
            '/grn'                                         AS Href,
            ISNULL(ns.IsRead, 0)                           AS IsRead,
            CONVERT(NVARCHAR(30), ISNULL(g.UpdatedAt, g.CreatedAt), 126) AS NotifTs
        FROM  inventory.GRNs g
        LEFT JOIN masters.Mills mil ON mil.Id = g.MillId
        LEFT JOIN system.NotificationState ns
               ON ns.NotifKey = 'GRN-' + CAST(g.Id AS NVARCHAR(10)) AND ns.UserId = @UserId
        WHERE g.IsDeleted = 0
          AND g.Status NOT IN ('Stock Updated')
          AND ISNULL(ns.IsDismissed, 0) = 0

        UNION ALL

        -- In-Transit Truck Load Plans awaiting GRN creation
        SELECT
            'TLP-' + CAST(tlp.Id AS NVARCHAR(10))                    AS [Key],
            'TLP'                                                      AS [Type],
            'GRN Pending — Truck In Transit'                           AS Title,
            'In Transit — GRN not yet created'                         AS Body,
            tlp.PlanNumber                                             AS RefNumber,
            '/grn'                                                     AS Href,
            ISNULL(ns.IsRead, 0)                                       AS IsRead,
            CONVERT(NVARCHAR(30), ISNULL(tlp.UpdatedAt, tlp.CreatedAt), 126) AS NotifTs
        FROM  procurement.TruckLoadPlans tlp
        LEFT JOIN system.NotificationState ns
               ON ns.NotifKey = 'TLP-' + CAST(tlp.Id AS NVARCHAR(10)) AND ns.UserId = @UserId
        WHERE tlp.IsDeleted = 0
          AND tlp.Status = 'Dispatched'
          AND NOT EXISTS (
              SELECT 1 FROM inventory.GRNs g
              WHERE g.SourceLoadPlanId = tlp.Id AND g.IsDeleted = 0
          )
          AND ISNULL(ns.IsDismissed, 0) = 0

        UNION ALL

        -- Mill Trackers needing follow-up
        SELECT
            'MILL-' + CAST(mt.Id AS NVARCHAR(10))                    AS [Key],
            'MILL'                                                     AS [Type],
            'Mill Order Status'                                        AS Title,
            mt.ProductionStatus + ' — ' + ISNULL(mi.Name, '')        AS Body,
            ISNULL(mt.Description, 'Mill Order')                      AS RefNumber,
            '/mill-tracker'                                            AS Href,
            ISNULL(ns.IsRead, 0)                                       AS IsRead,
            CONVERT(NVARCHAR(30), ISNULL(mt.UpdatedAt, mt.CreatedAt), 126) AS NotifTs
        FROM  procurement.MillTrackers mt
        LEFT JOIN masters.Mills mi ON mi.Id = mt.MillId
        LEFT JOIN system.NotificationState ns
               ON ns.NotifKey = 'MILL-' + CAST(mt.Id AS NVARCHAR(10)) AND ns.UserId = @UserId
        WHERE mt.IsDeleted = 0
          AND mt.ProductionStatus IN ('Order Placed','In Production','Partial Ready')
          AND ISNULL(ns.IsDismissed, 0) = 0

        ORDER BY NotifTs DESC";

    private const string MergeSql = @"
        MERGE system.NotificationState AS t
        USING (SELECT @UserId AS UserId, @Key AS NotifKey) AS s
              ON t.UserId = s.UserId AND t.NotifKey = s.NotifKey
        WHEN MATCHED THEN
            UPDATE SET {0} = 1, UpdatedAt = GETUTCDATE()
        WHEN NOT MATCHED THEN
            INSERT (UserId, NotifKey, IsRead, IsDismissed, UpdatedAt)
            VALUES (@UserId, @Key, {1}, {2}, GETUTCDATE());";

    public async Task<List<NotificationDto>> GetForUserAsync(int userId)
    {
        using var conn = db.Create();
        return (await conn.QueryAsync<NotificationDto>(LiveQuery, new { UserId = userId })).ToList();
    }

    public async Task MarkReadAsync(int userId, string key)
    {
        var sql = string.Format(MergeSql, "IsRead", "1", "0");
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { UserId = userId, Key = key });
    }

    public async Task MarkAllReadAsync(int userId, IEnumerable<string> keys)
    {
        using var conn = db.Create();
        var sql = string.Format(MergeSql, "IsRead", "1", "0");
        foreach (var key in keys)
            await conn.ExecuteAsync(sql, new { UserId = userId, Key = key });
    }

    public async Task DismissAsync(int userId, string key)
    {
        var sql = string.Format(MergeSql, "IsDismissed", "0", "1");
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { UserId = userId, Key = key });
    }

    public async Task DismissAllAsync(int userId, IEnumerable<string> keys)
    {
        using var conn = db.Create();
        var sql = string.Format(MergeSql, "IsDismissed", "0", "1");
        foreach (var key in keys)
            await conn.ExecuteAsync(sql, new { UserId = userId, Key = key });
    }
}
