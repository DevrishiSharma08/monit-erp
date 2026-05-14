using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Procurement;

public class PurchaseOrderRepository(DbConnectionFactory db) : IPurchaseOrderRepository
{
    private const string PoSelect = @"
        SELECT
            po.Id,
            po.PONumber,
            po.MillId,
            m.Name      AS MillName,
            m.Code      AS MillCode,
            CONVERT(NVARCHAR(10), po.OrderDate, 23)             AS OrderDate,
            po.POType,
            po.LinkedSOId,
            so.SONumber AS LinkedSONumber,
            po.DeliveryMode,
            ISNULL(po.ShipmentMode, 'Normal')                   AS ShipmentMode,
            po.BlindShipment,
            po.InvoiceParty,
            po.InvoicePartyId,
            po.DirectCustomerId,
            dc.Name     AS DirectCustomer,
            po.DirectDeliveryAddress,
            CONVERT(NVARCHAR(10), po.ExpectedDeliveryDate, 23)  AS ExpectedDeliveryDate,
            po.MillSONumber,
            po.PaymentTerms,
            po.TotalQuantity,
            po.TotalValue,
            po.Status,
            po.GSTPercentage,
            po.Remarks,
            po.SpecialInstructions,
            po.CreatedAt
        FROM   procurement.PurchaseOrders      po
        JOIN   masters.Mills                   m  ON m.Id  = po.MillId
        LEFT JOIN sales.SalesOrders            so ON so.Id = po.LinkedSOId
        LEFT JOIN masters.Customers            dc ON dc.Id = po.DirectCustomerId";

    private const string ItemSelect = @"
        SELECT
            poi.Id,
            poi.POId,
            poi.LineNumber,
            poi.MaterialId,
            poi.Description,
            poi.GSM,
            poi.Size,
            poi.Quantity,
            poi.WeightKg,
            poi.Unit,
            ISNULL(poi.Rate,     0) AS Rate,
            poi.Discount,
            ISNULL(poi.Amount,   0) AS Amount,
            poi.ReceivedQty,
            poi.PendingQty,
            poi.LinkedSOLineId,
            poi.Remark
        FROM procurement.PurchaseOrderItems poi
        WHERE poi.IsDeleted = 0";

    public async Task<PagedResult<PurchaseOrderListDto>> GetAllAsync(PurchaseOrderFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "OrderDate") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM procurement.PurchaseOrders po JOIN masters.Mills m ON m.Id=po.MillId WHERE {where}";
        var dataSql  = $"{PoSelect} WHERE {where} ORDER BY po.{orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var pos   = (await conn.QueryAsync<PurchaseOrderListDto>(dataSql, param)).ToList();

        if (pos.Count > 0)
            await AttachItems(conn, pos);

        return new PagedResult<PurchaseOrderListDto> { Items = pos, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<PurchaseOrderListDto?> GetByIdAsync(int id)
    {
        var sql = $"{PoSelect} WHERE po.Id=@Id AND po.IsDeleted=0";
        using var conn = db.Create();
        var po = await conn.QueryFirstOrDefaultAsync<PurchaseOrderListDto>(sql, new { Id = id });
        if (po == null) return null;

        var items = (await conn.QueryAsync<dynamic>($"{ItemSelect} AND poi.POId=@Id ORDER BY poi.LineNumber", new { Id = id })).ToList();
        po.Items = items.Select(MapItem).ToList();
        return po;
    }

    public async Task<int> CreateAsync(PurchaseOrderListDto po, IEnumerable<UpsertPurchaseOrderItemDto> items, string createdBy)
    {
        var year   = DateOnly.Parse(po.OrderDate).Year;
        var prefix = $"PO-{year}-";

        const string numSql = "SELECT ISNULL(MAX(CAST(SUBSTRING(PONumber, 9, 10) AS INT)), 0) + 1 FROM procurement.PurchaseOrders WHERE PONumber LIKE @Prefix AND IsDeleted = 0";
        const string poSql  = @"
            INSERT INTO procurement.PurchaseOrders
                (PONumber, MillId, OrderDate, POType, LinkedSOId, DeliveryMode, ShipmentMode,
                 BlindShipment, InvoiceParty, InvoicePartyId, DirectCustomerId, DirectDeliveryAddress,
                 ExpectedDeliveryDate, MillSONumber, PaymentTerms, TotalQuantity, TotalValue,
                 Status, GSTPercentage, Remarks, SpecialInstructions, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@PONumber, @MillId, @OrderDate, @POType, @LinkedSOId, @DeliveryMode, @ShipmentMode,
                 @BlindShipment, @InvoiceParty, @InvoicePartyId, @DirectCustomerId, @DirectDeliveryAddress,
                 @ExpectedDeliveryDate, @MillSONumber, @PaymentTerms, @TotalQuantity, @TotalValue,
                 @Status, @GSTPercentage, @Remarks, @SpecialInstructions, GETUTCDATE(), @CreatedBy)";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            var seq      = await conn.ExecuteScalarAsync<int>(numSql, new { Prefix = prefix + "%" }, tx);
            var poNumber = $"{prefix}{seq:D4}";

            var poId = await conn.ExecuteScalarAsync<int>(poSql, new
            {
                PONumber              = poNumber,
                po.MillId,
                OrderDate             = DateOnly.Parse(po.OrderDate),
                po.POType,
                po.LinkedSOId,
                po.DeliveryMode,
                ShipmentMode          = po.ShipmentMode ?? "Normal",
                po.BlindShipment,
                po.InvoiceParty,
                po.InvoicePartyId,
                po.DirectCustomerId,
                po.DirectDeliveryAddress,
                ExpectedDeliveryDate  = string.IsNullOrEmpty(po.ExpectedDeliveryDate) ? (DateOnly?)null : DateOnly.Parse(po.ExpectedDeliveryDate),
                po.MillSONumber,
                po.PaymentTerms,
                po.TotalQuantity,
                po.TotalValue,
                Status                = string.IsNullOrEmpty(po.Status) ? "Approval Pending" : po.Status,
                po.GSTPercentage,
                po.Remarks,
                po.SpecialInstructions,
                CreatedBy             = createdBy,
            }, tx);

            await InsertItems(conn, tx, poId, items, createdBy);
            tx.Commit();
            return poId;
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateAsync(int id, PurchaseOrderListDto po, IEnumerable<UpsertPurchaseOrderItemDto> items, string updatedBy)
    {
        const string sql = @"
            UPDATE procurement.PurchaseOrders SET
                MillId=@MillId, OrderDate=@OrderDate, POType=@POType, LinkedSOId=@LinkedSOId,
                DeliveryMode=@DeliveryMode, ShipmentMode=@ShipmentMode, BlindShipment=@BlindShipment,
                InvoiceParty=@InvoiceParty, InvoicePartyId=@InvoicePartyId,
                DirectCustomerId=@DirectCustomerId, DirectDeliveryAddress=@DirectDeliveryAddress,
                ExpectedDeliveryDate=@ExpectedDeliveryDate, MillSONumber=@MillSONumber,
                PaymentTerms=@PaymentTerms, TotalQuantity=@TotalQuantity, TotalValue=@TotalValue,
                Status=@Status, GSTPercentage=@GSTPercentage, Remarks=@Remarks,
                SpecialInstructions=@SpecialInstructions, UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy
            WHERE Id=@Id AND IsDeleted=0";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(sql, new
            {
                Id                    = id,
                po.MillId,
                OrderDate             = DateOnly.Parse(po.OrderDate),
                po.POType,
                po.LinkedSOId,
                po.DeliveryMode,
                ShipmentMode          = po.ShipmentMode ?? "Normal",
                po.BlindShipment,
                po.InvoiceParty,
                po.InvoicePartyId,
                po.DirectCustomerId,
                po.DirectDeliveryAddress,
                ExpectedDeliveryDate  = string.IsNullOrEmpty(po.ExpectedDeliveryDate) ? (DateOnly?)null : DateOnly.Parse(po.ExpectedDeliveryDate),
                po.MillSONumber,
                po.PaymentTerms,
                po.TotalQuantity,
                po.TotalValue,
                Status                = string.IsNullOrEmpty(po.Status) ? "Approval Pending" : po.Status,
                po.GSTPercentage,
                po.Remarks,
                po.SpecialInstructions,
                UpdatedBy             = updatedBy,
            }, tx);

            await conn.ExecuteAsync("DELETE FROM procurement.PurchaseOrderItems WHERE POId=@Id", new { Id = id }, tx);
            await InsertItems(conn, tx, id, items, updatedBy);
            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateStatusAsync(int id, string status, string updatedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE procurement.PurchaseOrders SET Status=@Status, UpdatedAt=GETUTCDATE(), UpdatedBy=@By WHERE Id=@Id AND IsDeleted=0",
            new { Id = id, Status = status, By = updatedBy });
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE procurement.PurchaseOrders SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE Id=@Id AND IsDeleted=0",
            new { Id = id, By = deletedBy });
        await conn.ExecuteAsync(
            "UPDATE procurement.PurchaseOrderItems SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE POId=@Id AND IsDeleted=0",
            new { Id = id, By = deletedBy });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task AttachItems(System.Data.IDbConnection conn, List<PurchaseOrderListDto> orders)
    {
        var ids     = orders.Select(o => o.Id).ToList();
        var sql     = $"{ItemSelect} AND poi.POId IN @Ids ORDER BY poi.POId, poi.LineNumber";
        var rows    = (await conn.QueryAsync<dynamic>(sql, new { Ids = ids })).ToList();
        var grouped = rows.GroupBy(r => (int)r.POId)
                          .ToDictionary(g => g.Key, g => g.Select(MapItem).ToList());

        foreach (var po in orders)
            po.Items = grouped.TryGetValue(po.Id, out var its) ? its : [];
    }

    private static async Task InsertItems(
        System.Data.IDbConnection      conn,
        System.Data.IDbTransaction     tx,
        int                            poId,
        IEnumerable<UpsertPurchaseOrderItemDto> items,
        string                         createdBy)
    {
        const string sql = @"
            INSERT INTO procurement.PurchaseOrderItems
                (POId, LineNumber, MaterialId, Description, GSM, Size, Quantity, WeightKg, Unit,
                 Rate, Discount, Amount, ReceivedQty, PendingQty, LinkedSOLineId, Remark, CreatedAt, CreatedBy)
            VALUES
                (@POId, @LineNumber, @MaterialId, @Description, @GSM, @Size, @Quantity, @WeightKg, @Unit,
                 @Rate, @Discount, @Amount, 0, @PendingQty, @LinkedSOLineId, @Remark, GETUTCDATE(), @CreatedBy)";

        foreach (var item in items)
        {
            await conn.ExecuteAsync(sql, new
            {
                POId           = poId,
                item.LineNumber,
                item.MaterialId,
                item.Description,
                item.GSM,
                item.Size,
                item.Quantity,
                WeightKg       = item.WeightKg,
                item.Unit,
                item.Rate,
                Discount       = item.Discount,
                item.Amount,
                PendingQty     = item.WeightKg.HasValue && item.WeightKg > 0 ? item.WeightKg : item.Quantity,
                item.LinkedSOLineId,
                item.Remark,
                CreatedBy      = createdBy,
            }, tx);
        }
    }

    private static PurchaseOrderItemDto MapItem(dynamic r) => new()
    {
        Id             = (int)r.Id,
        LineNumber     = (int)r.LineNumber,
        MaterialId     = (int)r.MaterialId,
        Description    = r.Description == null ? null : (string)r.Description,
        GSM            = r.GSM == null ? (int?)null : (int)r.GSM,
        Size           = r.Size == null ? null : (string)r.Size,
        Quantity       = (decimal)r.Quantity,
        WeightKg       = r.WeightKg == null ? (decimal?)null : (decimal)r.WeightKg,
        Unit           = r.Unit == null ? null : (string)r.Unit,
        Rate           = (decimal)r.Rate,
        Discount       = r.Discount == null ? (decimal?)null : (decimal)r.Discount,
        Amount         = (decimal)r.Amount,
        ReceivedQty    = (decimal)r.ReceivedQty,
        PendingQty     = (decimal)r.PendingQty,
        LinkedSOLineId = r.LinkedSOLineId == null ? (int?)null : (int)r.LinkedSOLineId,
        Remark         = r.Remark == null ? null : (string)r.Remark,
    };

    private static (string, DynamicParameters) BuildWhere(PurchaseOrderFilterRequest f)
    {
        var parts = new List<string> { "po.IsDeleted = 0" };
        var p     = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(po.PONumber LIKE @Search OR m.Name LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.Status)) { parts.Add("po.Status=@Status"); p.Add("Status", f.Status); }
        if (!string.IsNullOrWhiteSpace(f.POType)) { parts.Add("po.POType=@POType"); p.Add("POType", f.POType); }
        if (f.MillId.HasValue)                    { parts.Add("po.MillId=@MillId"); p.Add("MillId", f.MillId.Value); }

        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "PONumber", "OrderDate", "TotalValue", "Status" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
