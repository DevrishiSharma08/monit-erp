using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Sales;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Sales;

public class SalesOrderRepository(DbConnectionFactory db) : ISalesOrderRepository
{
    // ── Common list SELECT (no pagination or WHERE — appended by callers) ──────
    private const string ListSelect = @"
        SELECT
            so.Id,
            so.SONumber,
            so.CustomerId,
            so.ContactPersonId,
            so.SalesmanId,
            so.DeliveryPartyId,
            c.Name                                          AS Customer,
            c.GSTNo                                         AS CustomerGstNo,
            c.BillingAddress                                AS CustomerAddress,
            so.ContactPerson,
            cc.Phone                                        AS CustomerPhone,
            cc.Email                                        AS CustomerEmail,
            COALESCE(s.Name, so.SalesmanName)               AS Salesman,
            dp.Name                                         AS DeliveryParty,
            dp.GSTNo                                        AS DeliveryPartyGstNo,
            CONVERT(NVARCHAR(10), so.OrderDate, 23)         AS OrderDate,
            CONVERT(NVARCHAR(10), so.RequiredDeliveryDate, 23) AS RequiredDeliveryDate,
            so.Status,
            so.PaymentTerms,
            so.DeliveryMode,
            so.TotalValue,
            so.Remarks,
            so.InsurancePolicyNo,
            so.ShowBrandInItemCode,
            so.IsBackfilled,
            so.CancelReason,
            CONVERT(NVARCHAR(20), so.CancelledAt, 120) AS CancelledAt,
            so.CancelledBy,
            CONVERT(NVARCHAR(20), so.EmailSentAt, 120) AS EmailSentAt,
            (SELECT COUNT(*) FROM procurement.PurchaseOrders po
              WHERE po.LinkedSOId = so.Id AND po.IsDeleted = 0)  AS LinkedPoCount
        FROM   sales.SalesOrders          so
        JOIN   masters.Customers           c  ON c.Id  = so.CustomerId
        LEFT JOIN masters.Salesmen         s  ON s.Id  = so.SalesmanId
        LEFT JOIN masters.Customers        dp ON dp.Id = so.DeliveryPartyId
        LEFT JOIN masters.CustomerContacts cc ON cc.Id = so.ContactPersonId";

    // BrandName is exposed so the frontend can re-compose item codes with the
    // brand inserted when SalesOrders.ShowBrandInItemCode is on. Pulled from
    // the Quality alias (which is what the original ComposeCode used).
    private const string LineSelect = @"
        SELECT
            sol.Id,
            sol.SOId,
            sol.LineNumber,
            sol.MaterialId,
            sol.Description     AS MaterialCode,
            sg.Alias            AS BrandName,
            sol.GSM             AS Gsm,
            sol.Size,
            sol.Unit,
            sol.Quantity        AS OrderedQty,
            sol.Qty,
            sol.Rate,
            ISNULL(sol.Discount, 0)     AS Discount,
            ISNULL(sol.FinalPrice, sol.Rate - ISNULL(sol.Discount,0)) AS FinalPrice,
            sol.Amount,
            sol.DeliveryAddress,
            CONVERT(NVARCHAR(10), sol.DeliveryDate, 23) AS RequiredDeliveryDate,
            sol.Remarks,
            ISNULL(sol.LineStatus, 'Pending Allocation') AS Status,
            sol.AllocatedQty,
            sol.PendingQty
        FROM   sales.SalesOrderLines     sol
        LEFT JOIN masters.Materials      m  ON m.Id  = sol.MaterialId
        LEFT JOIN masters.StockSubGroups sg ON sg.Id = m.QualityId
        WHERE  sol.IsDeleted = 0";

    // ── GetAll ────────────────────────────────────────────────────────────────

    public async Task<PagedResult<SalesOrderListDto>> GetAllAsync(SalesOrderFilterRequest f)
    {
        var where  = new List<string> { "so.IsDeleted = 0" };
        var param  = new DynamicParameters();
        var sortBy = SafeCol(f.SortBy, "so.Id");

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            where.Add("(so.SONumber LIKE @Search OR c.Name LIKE @Search)");
            param.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            where.Add("so.Status = @Status");
            param.Add("Status", f.Status);
        }
        if (f.CustomerId.HasValue)
        {
            where.Add("so.CustomerId = @CustomerId");
            param.Add("CustomerId", f.CustomerId.Value);
        }
        if (!string.IsNullOrWhiteSpace(f.DateFrom))
        {
            where.Add("so.OrderDate >= @DateFrom");
            param.Add("DateFrom", f.DateFrom);
        }
        if (!string.IsNullOrWhiteSpace(f.DateTo))
        {
            where.Add("so.OrderDate <= @DateTo");
            param.Add("DateTo", f.DateTo);
        }

        var whereClause = string.Join(" AND ", where);
        var countSql = $"SELECT COUNT(*) FROM sales.SalesOrders so JOIN masters.Customers c ON c.Id=so.CustomerId WHERE {whereClause}";
        var dataSql  = $"{ListSelect} WHERE {whereClause} ORDER BY {sortBy} {f.SafeSortOrder} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<SalesOrderListDto>(dataSql, param)).ToList();

        if (items.Count > 0)
            await AttachLines(conn, items);

        return new PagedResult<SalesOrderListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    // ── GetById ───────────────────────────────────────────────────────────────

    public async Task<SalesOrderListDto?> GetByIdAsync(int id)
    {
        var sql = $"{ListSelect} WHERE so.Id = @Id AND so.IsDeleted = 0";
        using var conn = db.Create();
        var so = await conn.QueryFirstOrDefaultAsync<SalesOrderListDto>(sql, new { Id = id });
        if (so == null) return null;
        await AttachLines(conn, [so]);
        // populate DeliveryPartyAddress from first line
        so.DeliveryPartyAddress = so.Lines.FirstOrDefault()?.DeliveryAddress;
        return so;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public async Task<int> CreateAsync(CreateSalesOrderDto dto, string createdBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            // Backfill (historical) entries supply their own SO number — auto
            // sequence counter must NOT be advanced. Fresh orders go through
            // the sequencer as before.
            string soNumber;
            if (dto.IsBackfilled)
            {
                if (string.IsNullOrWhiteSpace(dto.SONumber))
                    throw new Monit.API.Common.Middleware.ValidationException("SO Number is required for backfilled entries.");
                var trimmed = dto.SONumber.Trim();
                var dupe = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM sales.SalesOrders WHERE SONumber = @N AND IsDeleted = 0",
                    new { N = trimmed }, tx);
                if (dupe > 0)
                    throw new Monit.API.Common.Middleware.ConflictException($"SO Number '{trimmed}' already exists.");
                soNumber = trimmed;
            }
            else
            {
                soNumber = await GenerateSONumberAsync(conn, tx, createdBy);
            }
            var salesmanId = await ResolveSalesmanIdAsync(conn, tx, dto.SalesmanName);

            const string insertSO = @"
                INSERT INTO sales.SalesOrders
                    (SONumber, CustomerId, ContactPersonId, ContactPerson,
                     SalesmanId, SalesmanName, DeliveryPartyId,
                     OrderDate, RequiredDeliveryDate, Status,
                     PaymentTerms, DeliveryMode,
                     TotalValue, Remarks, InsurancePolicyNo, ShowBrandInItemCode,
                     IsBackfilled, CreatedAt, CreatedBy)
                OUTPUT INSERTED.Id
                SELECT @SONumber, @CustomerId, @ContactPersonId, cp.Name,
                       @SalesmanId, @SalesmanName, @DeliveryPartyId,
                       @OrderDate, @RequiredDeliveryDate, 'Approval Pending',
                       @PaymentTerms, @DeliveryMode,
                       @TotalValue, @Remarks, @InsurancePolicyNo, @ShowBrandInItemCode,
                       @IsBackfilled, GETUTCDATE(), @CreatedBy
                FROM   (SELECT 1 AS dummy) AS _
                LEFT JOIN masters.CustomerContacts cp ON cp.Id = @ContactPersonId";

            var totalValue = dto.Lines.Sum(l => l.Amount);

            var soId = await conn.ExecuteScalarAsync<int>(insertSO, new
            {
                SONumber            = soNumber,
                dto.CustomerId,
                dto.ContactPersonId,
                SalesmanId          = salesmanId,
                SalesmanName        = dto.SalesmanName?.Trim(),
                dto.DeliveryPartyId,
                OrderDate           = ParseDate(dto.OrderDate),
                RequiredDeliveryDate = ParseDateNullable(dto.RequiredDeliveryDate),
                dto.PaymentTerms,
                dto.DeliveryMode,
                TotalValue          = totalValue,
                dto.Remarks,
                dto.InsurancePolicyNo,
                dto.ShowBrandInItemCode,
                dto.IsBackfilled,
                CreatedBy           = createdBy
            }, tx);

            await ReconcileLinesAsync(conn, tx, soId, dto.Lines, createdBy);
            tx.Commit();
            return soId;
        }
        catch { tx.Rollback(); throw; }
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public async Task UpdateAsync(int id, UpdateSalesOrderDto dto, string updatedBy)
    {
        using var conn = db.Create();
        using var tx   = conn.BeginTransaction();
        try
        {
            var salesmanId = await ResolveSalesmanIdAsync(conn, tx, dto.SalesmanName);
            var totalValue = dto.Lines.Sum(l => l.Amount);

            const string updateSO = @"
                UPDATE so SET
                    so.CustomerId           = @CustomerId,
                    so.ContactPersonId      = @ContactPersonId,
                    so.ContactPerson        = cp.Name,
                    so.SalesmanId           = @SalesmanId,
                    so.SalesmanName         = @SalesmanName,
                    so.DeliveryPartyId      = @DeliveryPartyId,
                    so.OrderDate            = @OrderDate,
                    so.RequiredDeliveryDate = @RequiredDeliveryDate,
                    so.Status               = ISNULL(@Status, so.Status),
                    so.PaymentTerms         = @PaymentTerms,
                    so.DeliveryMode         = @DeliveryMode,
                    so.TotalValue           = @TotalValue,
                    so.Remarks              = @Remarks,
                    so.InsurancePolicyNo    = @InsurancePolicyNo,
                    so.ShowBrandInItemCode  = @ShowBrandInItemCode,
                    so.UpdatedAt            = GETUTCDATE(),
                    so.UpdatedBy            = @UpdatedBy
                FROM sales.SalesOrders so
                LEFT JOIN masters.CustomerContacts cp ON cp.Id = @ContactPersonId
                WHERE so.Id = @Id AND so.IsDeleted = 0";

            await conn.ExecuteAsync(updateSO, new
            {
                Id                  = id,
                dto.CustomerId,
                dto.ContactPersonId,
                SalesmanId          = salesmanId,
                SalesmanName        = dto.SalesmanName?.Trim(),
                dto.DeliveryPartyId,
                OrderDate           = ParseDate(dto.OrderDate),
                RequiredDeliveryDate = ParseDateNullable(dto.RequiredDeliveryDate),
                dto.Status,
                dto.PaymentTerms,
                dto.DeliveryMode,
                TotalValue          = totalValue,
                dto.Remarks,
                dto.InsurancePolicyNo,
                dto.ShowBrandInItemCode,
                UpdatedBy           = updatedBy
            }, tx);

            await ReconcileLinesAsync(conn, tx, id, dto.Lines, updatedBy);
            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    // ── UpdateStatus (used by Approve / status transitions) ──────────────────

    public async Task UpdateStatusAsync(int id, string status, string updatedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE sales.SalesOrders SET Status=@Status, UpdatedAt=GETUTCDATE(), UpdatedBy=@By WHERE Id=@Id AND IsDeleted=0",
            new { Id = id, Status = status, By = updatedBy });
    }

    // ── SoftDelete ────────────────────────────────────────────────────────────

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(
            "UPDATE sales.SalesOrders SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE Id=@Id AND IsDeleted=0",
            new { Id = id, By = deletedBy });
        await conn.ExecuteAsync(
            "UPDATE sales.SalesOrderLines SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE SOId=@Id AND IsDeleted=0",
            new { Id = id, By = deletedBy });
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    // Distinct from delete: the SO row, number, and history stay intact (so it
    // remains visible + traceable in the grid, greyed out) — only Status flips
    // to 'Cancelled' with a mandatory reason. Idempotent: no-ops if already
    // cancelled so a double-click can't stomp the original reason/timestamp.

    public async Task CancelAsync(int id, string reason, string cancelledBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(@"
            UPDATE sales.SalesOrders
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
            "UPDATE sales.SalesOrders SET EmailSentAt = GETUTCDATE() WHERE Id = @Id AND IsDeleted = 0",
            new { Id = id });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task AttachLines(System.Data.IDbConnection conn, List<SalesOrderListDto> orders)
    {
        var ids = orders.Select(o => o.Id).ToList();
        var sql = $"{LineSelect} AND sol.SOId IN @Ids ORDER BY sol.SOId, sol.LineNumber";
        var lineRows = await conn.QueryAsync(sql, new { Ids = ids });
        var grouped  = lineRows.GroupBy(r => (int)r.SOId);
        var mapped   = new Dictionary<int, List<SalesOrderLineDto>>();
        foreach (var grp in grouped)
        {
            mapped[grp.Key] = grp.Select(r => new SalesOrderLineDto
            {
                Id                   = (int)r.Id,
                LineNumber           = (int)r.LineNumber,
                MaterialId           = r.MaterialId == null ? (int?)null : (int)r.MaterialId,
                MaterialCode         = (string?)r.MaterialCode,
                BrandName            = (string?)r.BrandName,
                Gsm                  = (int?)r.Gsm,
                Size                 = (string?)r.Size,
                Unit                 = (string?)r.Unit,
                OrderedQty           = (decimal)r.OrderedQty,
                Qty                  = (int?)r.Qty,
                Rate                 = (decimal)r.Rate,
                Discount             = (decimal)r.Discount,
                FinalPrice           = (decimal)r.FinalPrice,
                Amount               = (decimal)r.Amount,
                DeliveryAddress      = (string?)r.DeliveryAddress,
                RequiredDeliveryDate = (string?)r.RequiredDeliveryDate,
                Remarks              = (string?)r.Remarks,
                Status               = (string)r.Status,
                AllocatedQty         = (decimal)r.AllocatedQty,
                PendingQty           = (decimal)r.PendingQty,
            }).ToList();
        }

        foreach (var so in orders)
        {
            so.Lines             = mapped.TryGetValue(so.Id, out var ls) ? ls : [];
            so.DeliveryPartyAddress = so.Lines.FirstOrDefault()?.DeliveryAddress;
        }
    }

    // Reconciles submitted lines against what's already on file, matched by
    // Id, so an EDITED line keeps its original SalesOrderLines.Id forever —
    // it is UPDATED in place, never soft-deleted-and-reinserted under a new
    // Id. procurement.PurchaseOrderItems.LinkedSOLineId is a plain FK to
    // this Id with no reconciliation of its own — the old blanket
    // "soft-delete every line, reinsert everything fresh" behaviour
    // silently orphaned that link on EVERY SO save (even ones that only
    // touched Remarks), which broke the Order-Placed edit-lock guard: it
    // checks trackers via LinkedSOLineId, and a stale Id never matches
    // anything, so the guard silently no-ops once the link had already
    // rotted from an earlier edit (client-reported: SO edit went through
    // for an item already Partial Ready, when it should have been blocked).
    private async Task ReconcileLinesAsync(System.Data.IDbConnection conn, System.Data.IDbTransaction tx,
        int soId, List<UpsertSalesOrderLineDto> lines, string updatedBy)
    {
        var existingIds = (await conn.QueryAsync<int>(
            "SELECT Id FROM sales.SalesOrderLines WHERE SOId=@SOId AND IsDeleted=0",
            new { SOId = soId }, tx)).ToHashSet();

        const string updateSql = @"
            UPDATE sales.SalesOrderLines SET
                LineNumber=@LineNumber, MaterialId=@MaterialId, Description=@Description,
                GSM=@GSM, Size=@Size, Unit=@Unit, Quantity=@Quantity, Qty=@Qty,
                Rate=@Rate, Discount=@Discount, FinalPrice=@FinalPrice, Amount=@Amount,
                DeliveryDate=@DeliveryDate, DeliveryAddress=@DeliveryAddress, Remarks=@Remarks,
                UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy
            WHERE Id=@Id AND SOId=@SOId AND IsDeleted=0";

        const string insertSql = @"
            INSERT INTO sales.SalesOrderLines
                (SOId, LineNumber, MaterialId, Description, GSM, Size, Unit,
                 Quantity, Qty, Rate, Discount, FinalPrice, Amount,
                 DeliveryDate, DeliveryAddress, Remarks, LineStatus,
                 AllocatedQty, PendingQty, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@SOId, @LineNumber, @MaterialId, @Description, @GSM, @Size, @Unit,
                    @Quantity, @Qty, @Rate, @Discount, @FinalPrice, @Amount,
                    @DeliveryDate, @DeliveryAddress, @Remarks, 'Pending Allocation',
                    0, @Quantity, GETUTCDATE(), @CreatedBy)";

        // Figure out kept vs. removed BEFORE writing anything, and soft-
        // delete the removed ones FIRST. sales.SalesOrderLines has a
        // filtered UNIQUE index on (SOId, LineNumber) WHERE IsDeleted = 0 —
        // the frontend renumbers every remaining line sequentially after a
        // removal (line 1 deleted -> old line 2 becomes line 1), so if a
        // kept line's UPDATE (moving it into the freed-up LineNumber slot)
        // runs BEFORE the old line occupying that slot is soft-deleted, the
        // two active rows collide on the unique index and the whole save
        // throws (client-reported: removing an item then adding a new one
        // in the same edit threw "unexpected error").
        var keptIds = lines.Where(l => l.Id is > 0 && existingIds.Contains(l.Id.Value))
                            .Select(l => l.Id!.Value)
                            .ToHashSet();
        var removedIds = existingIds.Except(keptIds).ToList();
        if (removedIds.Count > 0)
        {
            await conn.ExecuteAsync(
                "UPDATE sales.SalesOrderLines SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@By WHERE Id IN @Ids",
                new { Ids = removedIds, By = updatedBy }, tx);
        }

        foreach (var line in lines)
        {
            // Free-text custom code? Try to auto-provision a master row first
            // so downstream stages (GRN / StockLots) can FK to a real Material.
            // Free-text is intentional (client uses it to add new size variants
            // of an existing item without leaving the SO), but the mill MUST
            // exist in this tenant's master for the auto-provisioner to
            // succeed. Silently accepting a null MaterialId was letting ghost
            // items (mill not in master) survive on the SO's Description
            // column, showing up as materials that "don't exist" in the
            // Item Master grid — reject those upfront with a clear message.
            var materialId = line.MaterialId;
            if (!materialId.HasValue && !string.IsNullOrWhiteSpace(line.MaterialCode))
            {
                materialId = await Services.Masters.MaterialAutoProvisioner
                    .EnsureAsync(conn, tx, line.MaterialCode, updatedBy);
                if (!materialId.HasValue)
                {
                    throw new Common.Middleware.ValidationException(
                        $"Line {line.LineNumber}: Item '{line.MaterialCode}' cannot be added — the mill in this code is not in your Item / Mill Master. Add the mill and the material to master first, or pick an existing item from the dropdown.");
                }
            }

            var parms = new
            {
                SOId         = soId,
                line.LineNumber,
                MaterialId   = materialId,
                Description  = line.MaterialCode,
                GSM          = line.Gsm,
                line.Size,
                line.Unit,
                Quantity     = line.OrderedQty,
                line.Qty,
                line.Rate,
                line.Discount,
                FinalPrice   = line.FinalPrice,
                line.Amount,
                DeliveryDate = ParseDateNullable(line.RequiredDeliveryDate),
                line.DeliveryAddress,
                line.Remarks,
            };

            if (line.Id is > 0 && existingIds.Contains(line.Id.Value))
            {
                await conn.ExecuteAsync(updateSql, new { Id = line.Id.Value, UpdatedBy = updatedBy, parms.SOId, parms.LineNumber, parms.MaterialId, parms.Description, parms.GSM, parms.Size, parms.Unit, parms.Quantity, parms.Qty, parms.Rate, parms.Discount, parms.FinalPrice, parms.Amount, parms.DeliveryDate, parms.DeliveryAddress, parms.Remarks }, tx);
            }
            else
            {
                await conn.ExecuteScalarAsync<int>(insertSql, new { parms.SOId, parms.LineNumber, parms.MaterialId, parms.Description, parms.GSM, parms.Size, parms.Unit, parms.Quantity, parms.Qty, parms.Rate, parms.Discount, parms.FinalPrice, parms.Amount, parms.DeliveryDate, parms.DeliveryAddress, parms.Remarks, CreatedBy = updatedBy }, tx);
            }
        }
    }

    private async Task<string> GenerateSONumberAsync(System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx, string user)
    {
        var year = DateTime.UtcNow.Year;
        var sql = @"
            DECLARE @Num INT; DECLARE @Prefix NVARCHAR(10) = 'SO'; DECLARE @Padding INT = 4;
            UPDATE system.NumberSequences WITH (UPDLOCK)
            SET @Num = LastNumber + 1, @Prefix = Prefix, @Padding = Padding,
                LastNumber = LastNumber + 1, UpdatedAt = GETUTCDATE(), UpdatedBy = @User
            WHERE Module = 'SO' AND [Year] = @Year;
            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO system.NumberSequences (Module,[Year],LastNumber,Prefix,Padding,CreatedBy)
                VALUES ('SO',@Year,1,'SO',4,@User);
                SET @Num = 1;
            END;
            SELECT @Prefix + '-' + CAST(@Year AS NVARCHAR(4)) + '-' +
                   RIGHT(REPLICATE('0',@Padding) + CAST(@Num AS NVARCHAR(10)), @Padding);";
        return await conn.ExecuteScalarAsync<string>(sql, new { Year = year, User = user }, tx) ?? $"SO-{year}-0001";
    }

    private async Task<int?> ResolveSalesmanIdAsync(System.Data.IDbConnection conn, System.Data.IDbTransaction tx, string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        return await conn.ExecuteScalarAsync<int?>(
            "SELECT TOP 1 Id FROM masters.Salesmen WHERE Name = @Name AND IsDeleted = 0",
            new { Name = name.Trim() }, tx);
    }

    private static DateTime ParseDate(string? s) =>
        DateTime.TryParse(s, out var d) ? d : DateTime.UtcNow.Date;

    private static DateTime? ParseDateNullable(string? s) =>
        DateTime.TryParse(s, out var d) ? d : null;

    private static string SafeCol(string? col, string fallback) =>
        col?.ToLower() switch
        {
            "sonumber"   => "so.SONumber",
            "orderdate"  => "so.OrderDate",
            "customer"   => "c.Name",
            "totalvalue" => "so.TotalValue",
            "status"     => "so.Status",
            _            => fallback
        };
}
