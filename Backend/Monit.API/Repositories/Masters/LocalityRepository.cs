using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class LocalityRepository(DbConnectionFactory db) : ILocalityRepository
{
    public async Task<PagedResult<LocalityListDto>> GetAllAsync(LocalityFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy  = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Localities WHERE {where}";
        var dataSql  = $"SELECT Id, Name, City, State, Description, IsActive, CreatedAt FROM masters.Localities WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<LocalityListDto>(dataSql, param)).ToList();
        return new PagedResult<LocalityListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<LocalityListDto>> GetAllForExportAsync(LocalityFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"SELECT Id, Name, City, State, Description, IsActive, CreatedAt FROM masters.Localities WHERE {where} ORDER BY {SafeColumn(f.SortBy, "Name")} {f.SafeSortOrder}";
        using var conn = db.Create();
        return (await conn.QueryAsync<LocalityListDto>(sql, param)).ToList();
    }

    public async Task<LocalityDetailDto?> GetByIdAsync(int id)
    {
        const string sql = "SELECT Id, Name, City, State, Description, IsActive, CreatedAt, UpdatedAt, UpdatedBy FROM masters.Localities WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<LocalityDetailDto>(sql, new { Id = id });
    }

    public async Task<List<LocalityDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Name, City FROM masters.Localities WHERE IsDeleted = 0 AND IsActive = 1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<LocalityDropdownDto>(sql)).ToList();
    }

    public async Task<int> CreateAsync(Locality e)
    {
        const string sql = @"
            INSERT INTO masters.Localities (Name, City, State, Description, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Name, @City, @State, @Description, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(Locality e)
    {
        const string sql = @"
            UPDATE masters.Localities SET
                Name=@Name, City=@City, State=@State, Description=@Description,
                IsActive=@IsActive, UpdatedAt=@UpdatedAt, UpdatedBy=@UpdatedBy
            WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Localities SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static (string, DynamicParameters) BuildWhere(LocalityFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(Name LIKE @Search OR City LIKE @Search OR State LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (f.IsActive.HasValue) { parts.Add("IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "Name", "City", "State", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
