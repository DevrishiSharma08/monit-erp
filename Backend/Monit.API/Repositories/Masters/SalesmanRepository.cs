using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class SalesmanRepository(DbConnectionFactory db) : ISalesmanRepository
{
    public async Task<PagedResult<SalesmanListDto>> GetAllAsync(SalesmanFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Salesmen WHERE {where}";
        var dataSql  = $"SELECT Id,Code,Name,Phone,Territory,IsActive,CreatedAt FROM masters.Salesmen WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<SalesmanListDto>(dataSql, param)).ToList();
        return new PagedResult<SalesmanListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<SalesmanListDto>> GetAllForExportAsync(SalesmanFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"SELECT Id,Code,Name,Phone,Territory,IsActive,CreatedAt FROM masters.Salesmen WHERE {where} ORDER BY Name ASC";
        using var conn = db.Create();
        return (await conn.QueryAsync<SalesmanListDto>(sql, param)).ToList();
    }

    public async Task<SalesmanDetailDto?> GetByIdAsync(int id)
    {
        const string sql = "SELECT Id,Code,Name,Phone,Email,Territory,UserId,IsActive,CreatedAt,UpdatedAt,UpdatedBy FROM masters.Salesmen WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<SalesmanDetailDto>(sql, new { id });
    }

    public async Task<List<SalesmanDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id,Code,Name FROM masters.Salesmen WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<SalesmanDropdownDto>(sql)).ToList();
    }

    public async Task<List<SalesmanForSODto>> GetForSOAsync()
    {
        const string sql = @"
            SELECT u.Id, u.Name
            FROM   auth.Users u
            WHERE  u.Role = 'Salesman' AND u.IsActive = 1 AND u.IsDeleted = 0
            ORDER BY u.Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<SalesmanForSODto>(sql)).ToList();
    }

    public async Task<bool> CodeExistsAsync(string code, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM masters.Salesmen WHERE Code=@Code AND IsDeleted=0 AND (@ExcludeId IS NULL OR Id<>@ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Code = code, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(Salesman e)
    {
        const string sql = "INSERT INTO masters.Salesmen (Code,Name,Phone,Email,Territory,UserId,IsActive,CreatedAt,CreatedBy) OUTPUT INSERTED.Id VALUES (@Code,@Name,@Phone,@Email,@Territory,@UserId,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(Salesman e)
    {
        const string sql = "UPDATE masters.Salesmen SET Code=@Code,Name=@Name,Phone=@Phone,Email=@Email,Territory=@Territory,UserId=@UserId,IsActive=@IsActive,UpdatedAt=@UpdatedAt,UpdatedBy=@UpdatedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Salesmen SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static (string, DynamicParameters) BuildWhere(SalesmanFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))    { parts.Add("(Name LIKE @Search OR Code LIKE @Search OR Phone LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (!string.IsNullOrWhiteSpace(f.Territory)) { parts.Add("Territory = @Territory"); p.Add("Territory", f.Territory); }
        if (f.IsActive.HasValue) { parts.Add("IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase) { "Id", "Code", "Name", "Territory", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
