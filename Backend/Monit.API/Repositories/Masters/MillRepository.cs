using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class MillRepository(DbConnectionFactory db) : IMillRepository
{
    public async Task<PagedResult<MillListDto>> GetAllAsync(MillFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "m.Name") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM masters.Mills m WHERE {where}";
        var dataSql  = $@"
            SELECT m.Id, m.Code, m.Name, m.OwnerName, m.Phone, m.Email,
                   m.GstNo, m.PaymentTerms, m.IsActive, m.CreatedAt,
                   (SELECT COUNT(*) FROM masters.MillUnits WHERE MillId = m.Id AND IsDeleted = 0) AS UnitCount
            FROM   masters.Mills m
            WHERE  {where}
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<MillListDto>(dataSql, param)).ToList();
        return new PagedResult<MillListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<MillListDto>> GetAllForExportAsync(MillFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "m.Name") + " " + f.SafeSortOrder;
        var sql = $@"
            SELECT m.Id, m.Code, m.Name, m.OwnerName, m.Phone, m.Email,
                   m.GstNo, m.PaymentTerms, m.IsActive, m.CreatedAt,
                   (SELECT COUNT(*) FROM masters.MillUnits WHERE MillId = m.Id AND IsDeleted = 0) AS UnitCount
            FROM   masters.Mills m WHERE {where} ORDER BY {orderBy}";
        using var conn = db.Create();
        return (await conn.QueryAsync<MillListDto>(sql, param)).ToList();
    }

    public async Task<MillDetailDto?> GetByIdAsync(int id)
    {
        const string multiSql = @"
            SELECT m.Id, m.Code, m.Name, m.OwnerName, m.Phone, m.Email,
                   m.GstNo, m.PaymentTerms, m.IsActive, m.CreatedAt,
                   m.UpdatedAt, m.UpdatedBy,
                   (SELECT COUNT(*) FROM masters.MillUnits WHERE MillId = m.Id AND IsDeleted = 0) AS UnitCount
            FROM   masters.Mills m WHERE m.Id = @Id AND m.IsDeleted = 0;

            SELECT Id, MillId, UnitName, Address, IsDefault
            FROM   masters.MillUnits WHERE MillId = @Id AND IsDeleted = 0 ORDER BY Id;

            SELECT mc.Id, mc.MillUnitId, mc.ContactPerson, mc.Designation, mc.Phone, mc.Email, mc.IsDefault
            FROM   masters.MillContacts mc
            JOIN   masters.MillUnits    mu ON mu.Id = mc.MillUnitId
            WHERE  mu.MillId = @Id AND mc.IsDeleted = 0 AND mu.IsDeleted = 0
            ORDER  BY mc.MillUnitId, mc.Id;";

        using var conn = db.Create();
        using var multi = await conn.QueryMultipleAsync(multiSql, new { Id = id });

        var mill = await multi.ReadFirstOrDefaultAsync<MillDetailDto>();
        if (mill == null) return null;

        var units    = (await multi.ReadAsync<MillUnitDto>()).ToList();
        var contacts = (await multi.ReadAsync<MillContactRaw>()).ToList();

        foreach (var unit in units)
            unit.Contacts = contacts.Where(c => c.MillUnitId == unit.Id)
                                    .Select(c => new MillContactDto
                                    {
                                        Id = c.Id, ContactPerson = c.ContactPerson,
                                        Designation = c.Designation, Phone = c.Phone, Email = c.Email,
                                        IsDefault = c.IsDefault
                                    }).ToList();

        mill.Units = units;
        return mill;
    }

    public async Task<bool> CodeExistsAsync(string code, int? excludeId = null)
    {
        const string sql = @"SELECT COUNT(1) FROM masters.Mills WHERE Code = @Code AND IsDeleted = 0
                             AND (@ExcludeId IS NULL OR Id <> @ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Code = code, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(Mill m, List<MillUnitDto> units, string createdBy)
    {
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();

        const string insertMill = @"
            INSERT INTO masters.Mills (Code, Name, OwnerName, Phone, Email, GstNo, PaymentTerms, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code, @Name, @OwnerName, @Phone, @Email, @GstNo, @PaymentTerms, @IsActive, @CreatedAt, @CreatedBy)";

        var millId = await conn.ExecuteScalarAsync<int>(insertMill, m, tx);
        await SaveUnits(conn, tx, millId, units, createdBy);

        tx.Commit();
        return millId;
    }

    public async Task UpdateAsync(Mill m, List<MillUnitDto> units, string updatedBy)
    {
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();

        const string updateMill = @"
            UPDATE masters.Mills SET
                Code = @Code, Name = @Name, OwnerName = @OwnerName,
                Phone = @Phone, Email = @Email, GstNo = @GstNo, PaymentTerms = @PaymentTerms,
                IsActive = @IsActive, UpdatedAt = @UpdatedAt, UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";

        await conn.ExecuteAsync(updateMill, m, tx);

        // Soft-delete old contacts then old units
        const string deleteContacts = @"
            UPDATE masters.MillContacts SET IsDeleted=1
            WHERE MillUnitId IN (SELECT Id FROM masters.MillUnits WHERE MillId=@Id AND IsDeleted=0)";
        await conn.ExecuteAsync(deleteContacts, new { m.Id }, tx);

        const string deleteUnits = "UPDATE masters.MillUnits SET IsDeleted=1 WHERE MillId=@Id AND IsDeleted=0";
        await conn.ExecuteAsync(deleteUnits, new { m.Id }, tx);

        await SaveUnits(conn, tx, m.Id, units, updatedBy);

        tx.Commit();
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Mills SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    public async Task<List<MillDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Code, Name FROM masters.Mills WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<MillDropdownDto>(sql)).ToList();
    }

    private static async Task SaveUnits(
        System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx,
        int millId,
        List<MillUnitDto> units,
        string createdBy)
    {
        const string insertUnit = @"
            INSERT INTO masters.MillUnits (MillId, UnitName, Address, IsDefault, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@MillId, @UnitName, @Address, @IsDefault, 1, GETUTCDATE(), @CreatedBy)";

        const string insertContact = @"
            INSERT INTO masters.MillContacts (MillUnitId, ContactPerson, Designation, Phone, Email, IsDefault, IsActive, CreatedAt, CreatedBy)
            VALUES (@MillUnitId, @ContactPerson, @Designation, @Phone, @Email, @IsDefault, 1, GETUTCDATE(), @CreatedBy)";

        foreach (var unit in units.Where(u => !string.IsNullOrWhiteSpace(u.UnitName)))
        {
            var unitId = await conn.ExecuteScalarAsync<int>(insertUnit,
                new { MillId = millId, unit.UnitName, unit.Address, unit.IsDefault, CreatedBy = createdBy }, tx);

            foreach (var c in unit.Contacts.Where(c => !string.IsNullOrWhiteSpace(c.ContactPerson)))
                await conn.ExecuteAsync(insertContact,
                    new { MillUnitId = unitId, c.ContactPerson, c.Designation, c.Phone, c.Email, c.IsDefault, CreatedBy = createdBy }, tx);
        }
    }

    private static (string clause, DynamicParameters param) BuildWhere(MillFilterRequest f)
    {
        var parts = new List<string> { "m.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(m.Name LIKE @Search OR m.Code LIKE @Search OR m.OwnerName LIKE @Search OR m.Phone LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (f.IsActive.HasValue) { parts.Add("m.IsActive = @IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "m.Id", "m.Code", "m.Name", "m.IsActive", "m.CreatedAt" };
    private static string SafeColumn(string? col, string def)
        => AllowedSort.Contains("m." + (col ?? "")) ? "m." + col! : def;

    private record MillContactRaw(int Id, int MillUnitId, string ContactPerson, string? Designation, string? Phone, string? Email, bool IsDefault);
}
