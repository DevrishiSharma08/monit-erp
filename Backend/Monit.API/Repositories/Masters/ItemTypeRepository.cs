using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class ItemTypeRepository(DbConnectionFactory db) : IItemTypeRepository
{
    public async Task<PagedResult<ItemTypeListDto>> GetAllAsync(ItemTypeFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.ItemTypes WHERE {where}";
        var dataSql  = $"SELECT Id, Code, Name, Description, IsActive, CreatedAt FROM masters.ItemTypes WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<ItemTypeListDto>(dataSql, param)).ToList();
        return new PagedResult<ItemTypeListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<ItemTypeListDto>> GetAllForExportAsync(ItemTypeFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"SELECT Id, Code, Name, Description, IsActive, CreatedAt FROM masters.ItemTypes WHERE {where} ORDER BY {SafeColumn(f.SortBy, "Name")} {f.SafeSortOrder}";
        using var conn = db.Create();
        return (await conn.QueryAsync<ItemTypeListDto>(sql, param)).ToList();
    }

    public async Task<ItemTypeDetailDto?> GetByIdAsync(int id)
    {
        const string sql = "SELECT Id, Code, Name, Description, IsActive, CreatedAt, UpdatedAt, UpdatedBy FROM masters.ItemTypes WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<ItemTypeDetailDto>(sql, new { id });
    }

    public async Task<List<ItemTypeDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Code, Name FROM masters.ItemTypes WHERE IsDeleted = 0 AND IsActive = 1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<ItemTypeDropdownDto>(sql)).ToList();
    }

    public async Task<bool> CodeExistsAsync(string code, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM masters.ItemTypes WHERE Code=@Code AND IsDeleted=0 AND (@ExcludeId IS NULL OR Id<>@ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Code = code, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(ItemType e)
    {
        const string sql = "INSERT INTO masters.ItemTypes (Code,Name,Description,IsActive,CreatedAt,CreatedBy) OUTPUT INSERTED.Id VALUES (@Code,@Name,@Description,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(ItemType e)
    {
        const string sql = "UPDATE masters.ItemTypes SET Code=@Code,Name=@Name,Description=@Description,IsActive=@IsActive,UpdatedAt=@UpdatedAt,UpdatedBy=@UpdatedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.ItemTypes SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static (string, DynamicParameters) BuildWhere(ItemTypeFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("(Name LIKE @Search OR Code LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue) { parts.Add("IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase) { "Id", "Code", "Name", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
