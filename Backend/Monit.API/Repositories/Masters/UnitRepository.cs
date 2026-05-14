using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class UnitRepository(DbConnectionFactory db) : IUnitRepository
{
    public async Task<PagedResult<UnitListDto>> GetAllAsync(UnitFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM masters.Units WHERE {where}";
        var dataSql  = $@"
            SELECT Id, Name, Description, IsActive, CreatedAt
            FROM   masters.Units
            WHERE  {where}
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<UnitListDto>(dataSql, param)).ToList();
        return new PagedResult<UnitListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<UnitListDto>> GetAllForExportAsync(UnitFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var sql = $"SELECT Id, Name, Description, IsActive, CreatedAt FROM masters.Units WHERE {where} ORDER BY {orderBy}";
        using var conn = db.Create();
        return (await conn.QueryAsync<UnitListDto>(sql, param)).ToList();
    }

    public async Task<UnitDetailDto?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT Id, Name, Description, IsActive, CreatedAt, UpdatedAt, UpdatedBy
            FROM   masters.Units
            WHERE  Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<UnitDetailDto>(sql, new { id });
    }

    public async Task<bool> NameExistsAsync(string name, int? excludeId = null)
    {
        const string sql = @"SELECT COUNT(1) FROM masters.Units WHERE Name = @Name AND IsDeleted = 0
                             AND (@ExcludeId IS NULL OR Id <> @ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Name = name, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(Unit e)
    {
        const string sql = @"
            INSERT INTO masters.Units (Name, Description, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Name, @Description, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(Unit e)
    {
        const string sql = @"
            UPDATE masters.Units SET
                Name = @Name, Description = @Description,
                IsActive = @IsActive, UpdatedAt = @UpdatedAt, UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Units SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    public async Task<List<UnitDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Name FROM masters.Units WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<UnitDropdownDto>(sql)).ToList();
    }

    private static (string clause, DynamicParameters param) BuildWhere(UnitFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("Name LIKE @Search");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (f.IsActive.HasValue) { parts.Add("IsActive = @IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "Name", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
