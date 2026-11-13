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
            ISNULL(m.Name, '')  AS MillName,
            ISNULL(m.Code, '')  AS MillCode,
            -- GST/Address are per-unit. The fallback to a different unit
            -- under this mill must ONLY fire when the PO never picked a
            -- unit at all (legacy / plain general PO to the mill). It must
            -- NOT fire just because the PICKED unit's own GST/Address
            -- happens to be blank in the master, since that silently
            -- substitutes a DIFFERENT unit's real GST/address (client-
            -- reported: a PO raised against ITC's Bhadrachalam unit printed
            -- OMNI unit's street address on the Order-To block, because
            -- Bhadrachalam's own Address field was empty in
            -- masters.MillUnits and the query grabbed a sibling unit's
            -- address instead of leaving it blank).
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
            CONVERT(NVARCHAR(10), po.OrderDate, 23)             AS OrderDate,
            po.POType,
            po.LinkedSOId,
            so.SONumber AS LinkedSONumber,
            -- Customer info via linked SO -- feeds the PDF Shipped-To
            -- fallback when the PO itself does not carry DirectCustomer
            -- details (so the mill still sees the real end-customer for
            -- POs raised against an SO).
            soc.Name         AS LinkedSOCustomerName,
            soc.BillingAddress AS LinkedSOCustomerAddress,
            soc.GSTNo        AS LinkedSOCustomerGstNo,
            -- SO's own separate delivery party (Customer A ordered, ships to
            -- Customer B) -- same DeliveryPartyId concept the SO's own
            -- PDF/View already resolves via masters.Customers. Address comes
            -- from the SO's first line, matching SalesOrderRepository's own
            -- DeliveryPartyAddress-from-first-line logic.
            sodp.Name        AS LinkedSODeliveryPartyName,
            sodp.GSTNo       AS LinkedSODeliveryPartyGstNo,
            (SELECT TOP 1 sol.DeliveryAddress
             FROM   sales.SalesOrderLines sol
             WHERE  sol.SOId = so.Id AND sol.IsDeleted = 0
             ORDER BY sol.LineNumber)                          AS LinkedSODeliveryPartyAddress,
            po.ShowDeliveryParty,
            po.ShowCustomerName,
            po.DeliveryMode,
            ISNULL(po.ShipmentMode, 'Normal')                   AS ShipmentMode,
            po.BlindShipment,
            po.InvoiceParty,
            po.InvoicePartyId,
            -- Override invoice party master details — when the user picked an
            -- existing customer for InvoicePartyId, surface its GST and
            -- billing address so the PO PDF / email shows the override
            -- entity's real GST (not blank).
            ip.GSTNo                                            AS InvoicePartyGstNo,
            ip.BillingAddress                                   AS InvoicePartyAddress,
            po.DirectCustomerId,
            dc.Name                                             AS DirectCustomer,
            dc.GSTNo                                            AS DirectCustomerGstNo,
            dc.BillingAddress                                   AS DirectCustomerAddress,
            po.DirectDeliveryAddress,
            CONVERT(NVARCHAR(10), po.ExpectedDeliveryDate, 23)  AS ExpectedDeliveryDate,
            po.MillSONumber,
            po.PaymentTerms,
            po.InsurancePolicyNo,
            po.TotalQuantity,
            po.TotalValue,
            po.Status,
            po.GSTPercentage,
            po.Remarks,
            po.SpecialInstructions,
            po.CreatedAt,
            po.IsBackfilled,
            po.CancelReason,
            CONVERT(NVARCHAR(20), po.CancelledAt, 120) AS CancelledAt,
            po.CancelledBy,
            CONVERT(NVARCHAR(20), po.EmailSentAt, 120) AS EmailSentAt,
            CONVERT(NVARCHAR(20), po.UpdatedAt,   120) AS UpdatedAt
        FROM   procurement.PurchaseOrders      po
        LEFT JOIN masters.Mills                m  ON m.Id  = po.MillId
        LEFT JOIN masters.MillUnits            mu ON mu.Id = po.MillUnitId
        LEFT JOIN sales.SalesOrders            so ON so.Id = po.LinkedSOId
        LEFT JOIN masters.Customers            soc ON soc.Id = so.CustomerId
        LEFT JOIN masters.Customers            sodp ON sodp.Id = so.DeliveryPartyId
        LEFT JOIN masters.Customers            dc ON dc.Id = po.DirectCustomerId
        LEFT JOIN masters.Customers            ip ON ip.Id = po.InvoicePartyId";

    private const string ItemSelect = @"
        SELECT
            poi.Id,
            poi.POId,
            poi.LineNumber,
            poi.MaterialId,
            poi.Description,
            -- BrandName is the StockSubGroup alias on the material's quality
            -- — surfaced so the PO PDF / email can render brand as its own
            -- column instead of mashing it into the Item Code.
            sg.Alias                        AS BrandName,
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
        LEFT JOIN masters.Materials      m  ON m.Id  = poi.MaterialId
        LEFT JOIN masters.StockSubGroups sg ON sg.Id = m.QualityId
        WHERE poi.IsDeleted = 0";

    public async Task<PagedResult<PurchaseOrderListDto>> GetAllAsync(PurchaseOrderFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "OrderDate") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM procurement.PurchaseOrders po LEFT JOIN masters.Mills m ON m.Id=po.MillId LEFT JOIN sales.SalesOrders so ON so.Id=po.LinkedSOId WHERE {where}";
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
                (PONumber, MillId, MillUnitId, OrderDate, POType, LinkedSOId, DeliveryMode, ShipmentMode,
                 BlindShipment, ShowDeliveryParty, ShowCustomerName, InvoiceParty, InvoicePartyId, DirectCustomerId, DirectDeliveryAddress,
                 ExpectedDeliveryDate, MillSONumber, PaymentTerms, InsurancePolicyNo, TotalQuantity, TotalValue,
                 Status, GSTPercentage, Remarks, SpecialInstructions, IsBackfilled, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@PONumber, @MillId, @MillUnitId, @OrderDate, @POType, @LinkedSOId, @DeliveryMode, @ShipmentMode,
                 @BlindShipment, @ShowDeliveryParty, @ShowCustomerName, @InvoiceParty, @InvoicePartyId, @DirectCustomerId, @DirectDeliveryAddress,
                 @ExpectedDeliveryDate, @MillSONumber, @PaymentTerms, @InsurancePolicyNo, @TotalQuantity, @TotalValue,
                 @Status, @GSTPercentage, @Remarks, @SpecialInstructions, @IsBackfilled, GETUTCDATE(), @CreatedBy)";

        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Backfill (historical) entries supply their own PO number — the
            // auto MAX(PONumber)+1 query must NOT run for them (their custom
            // format wouldn't match the 'PO-<year>-' pattern it scans anyway,
            // so skipping it here is purely to avoid wasting a lookup, not a
            // correctness requirement). Fresh orders go through the same
            // MAX-based generation as before.
            string poNumber;
            if (po.IsBackfilled)
            {
                if (string.IsNullOrWhiteSpace(po.PONumber))
                    throw new Common.Middleware.ValidationException("PO Number is required for backfilled entries.");
                var trimmed = po.PONumber.Trim();
                var dupe = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM procurement.PurchaseOrders WHERE PONumber = @N AND IsDeleted = 0",
                    new { N = trimmed }, tx);
                if (dupe > 0)
                    throw new Common.Middleware.ConflictException($"PO Number '{trimmed}' already exists.");
                poNumber = trimmed;
            }
            else
            {
                var seq = await conn.ExecuteScalarAsync<int>(numSql, new { Prefix = prefix + "%" }, tx);
                poNumber = $"{prefix}{seq:D4}";
            }

            var poId = await conn.ExecuteScalarAsync<int>(poSql, new
            {
                PONumber              = poNumber,
                po.IsBackfilled,
                po.MillId,
                po.MillUnitId,
                OrderDate             = DateOnly.Parse(po.OrderDate),
                po.POType,
                po.LinkedSOId,
                po.DeliveryMode,
                ShipmentMode          = po.ShipmentMode ?? "Normal",
                po.BlindShipment,
                po.ShowDeliveryParty,
                po.ShowCustomerName,
                po.InvoiceParty,
                po.InvoicePartyId,
                po.DirectCustomerId,
                po.DirectDeliveryAddress,
                ExpectedDeliveryDate  = string.IsNullOrEmpty(po.ExpectedDeliveryDate) ? (DateOnly?)null : DateOnly.Parse(po.ExpectedDeliveryDate),
                po.MillSONumber,
                po.PaymentTerms,
                po.InsurancePolicyNo,
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
                MillId=@MillId, MillUnitId=@MillUnitId, OrderDate=@OrderDate, POType=@POType, LinkedSOId=@LinkedSOId,
                DeliveryMode=@DeliveryMode, ShipmentMode=@ShipmentMode, BlindShipment=@BlindShipment,
                ShowDeliveryParty=@ShowDeliveryParty, ShowCustomerName=@ShowCustomerName,
                InvoiceParty=@InvoiceParty, InvoicePartyId=@InvoicePartyId,
                DirectCustomerId=@DirectCustomerId, DirectDeliveryAddress=@DirectDeliveryAddress,
                ExpectedDeliveryDate=@ExpectedDeliveryDate, MillSONumber=@MillSONumber,
                PaymentTerms=@PaymentTerms, InsurancePolicyNo=@InsurancePolicyNo, TotalQuantity=@TotalQuantity, TotalValue=@TotalValue,
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
                po.MillUnitId,
                OrderDate             = DateOnly.Parse(po.OrderDate),
                po.POType,
                po.LinkedSOId,
                po.DeliveryMode,
                ShipmentMode          = po.ShipmentMode ?? "Normal",
                po.BlindShipment,
                po.ShowDeliveryParty,
                po.ShowCustomerName,
                po.InvoiceParty,
                po.InvoicePartyId,
                po.DirectCustomerId,
                po.DirectDeliveryAddress,
                ExpectedDeliveryDate  = string.IsNullOrEmpty(po.ExpectedDeliveryDate) ? (DateOnly?)null : DateOnly.Parse(po.ExpectedDeliveryDate),
                po.MillSONumber,
                po.PaymentTerms,
                po.InsurancePolicyNo,
                po.TotalQuantity,
                po.TotalValue,
                Status                = string.IsNullOrEmpty(po.Status) ? "Approval Pending" : po.Status,
                po.GSTPercentage,
                po.Remarks,
                po.SpecialInstructions,
                UpdatedBy             = updatedBy,
            }, tx);

            // Soft-delete existing items — hard DELETE would violate FK_MillTrackers_POItem
            await conn.ExecuteAsync(
                "UPDATE procurement.PurchaseOrderItems SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE POId=@Id AND IsDeleted=0",
                new { Id = id, By = updatedBy }, tx);
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

    // ── Cancel ────────────────────────────────────────────────────────────────
    // Distinct from delete: the PO row, number, and history stay intact (so it
    // remains visible + traceable in the grid, greyed out) — only Status flips
    // to 'Cancelled' with a mandatory reason. Idempotent: no-ops if already
    // cancelled so a double-click can't stomp the original reason/timestamp.

    public async Task CancelAsync(int id, string reason, string cancelledBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(@"
            UPDATE procurement.PurchaseOrders
            SET    [Status]     = 'Cancelled',
                   CancelReason = @Reason,
                   CancelledAt  = GETUTCDATE(),
                   CancelledBy  = @By,
                   UpdatedAt    = GETUTCDATE(),
                   UpdatedBy    = @By
            WHERE  Id = @Id AND IsDeleted = 0 AND [Status] <> 'Cancelled'",
            new { Id = id, Reason = reason, By = cancelledBy });
    }

    // ── MarkEmailSent ─────────────────────────────────────────────────────────

    public async Task MarkEmailSentAsync(int id)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE procurement.PurchaseOrders SET EmailSentAt = GETUTCDATE() WHERE Id = @Id AND IsDeleted = 0",
            new { Id = id });
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
            // Free-text custom code? Try to auto-provision a master row first
            // so downstream stages (MillTracker / GRN / StockLots) can FK to
            // a real Material. Free-text is intentional (adding new size
            // variants of an existing item without leaving the PO) but the
            // mill MUST exist in this tenant's master for the auto-provisioner
            // to succeed. Silent null was letting ghost items survive on the
            // PO — matching the SO fix.
            var materialId = item.MaterialId;
            if (!materialId.HasValue && !string.IsNullOrWhiteSpace(item.Description))
            {
                materialId = await Services.Masters.MaterialAutoProvisioner
                    .EnsureAsync(conn, tx, item.Description, createdBy);
                if (!materialId.HasValue)
                {
                    throw new Common.Middleware.ValidationException(
                        $"Line {item.LineNumber}: Item '{item.Description}' cannot be added — the mill in this code is not in your Item / Mill Master. Add the mill and the material to master first, or pick an existing item from the dropdown.");
                }
            }

            await conn.ExecuteAsync(sql, new
            {
                POId           = poId,
                item.LineNumber,
                MaterialId     = materialId,
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
        MaterialId     = r.MaterialId == null ? (int?)null : (int)r.MaterialId,
        Description    = r.Description == null ? null : (string)r.Description,
        BrandName      = r.BrandName  == null ? null : (string)r.BrandName,
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
        // Hide POs whose parent SO is still pending approval — Approvals page opts in.
        // COALESCE handles NULL so.Status (orphaned LinkedSOId or SO with NULL status):
        // such POs are treated as "SO not pending" so they still appear in approvals.
        if (f.RequireSoApproved)
            parts.Add("(po.LinkedSOId IS NULL OR COALESCE(so.Status, '') <> 'Approval Pending')");

        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "PONumber", "OrderDate", "TotalValue", "Status" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
