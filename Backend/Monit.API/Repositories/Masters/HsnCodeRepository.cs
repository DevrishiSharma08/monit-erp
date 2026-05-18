using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class HsnCodeRepository(DbConnectionFactory db) : IHsnCodeRepository
{
    public async Task<PagedResult<HsnCodeListDto>> GetAllAsync(HsnCodeFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Code") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.HsnCodes WHERE {where}";
        var dataSql  = $@"
            SELECT Id, Code, Description, GstPercent, IsActive, CreatedAt
            FROM   masters.HsnCodes
            WHERE  {where}
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<HsnCodeListDto>(dataSql, param)).ToList();
        return new PagedResult<HsnCodeListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<HsnCodeListDto>> GetAllForExportAsync(HsnCodeFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Code") + " " + f.SafeSortOrder;
        var sql = $"SELECT Id, Code, Description, GstPercent, IsActive, CreatedAt FROM masters.HsnCodes WHERE {where} ORDER BY {orderBy}";
        using var conn = db.Create();
        return (await conn.QueryAsync<HsnCodeListDto>(sql, param)).ToList();
    }

    public async Task<HsnCodeDetailDto?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT Id, Code, Description, GstPercent, IsActive, CreatedAt, UpdatedAt, UpdatedBy
            FROM   masters.HsnCodes
            WHERE  Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<HsnCodeDetailDto>(sql, new { Id = id });
    }

    public async Task<bool> CodeExistsAsync(string code, int? excludeId = null)
    {
        const string sql = @"SELECT COUNT(1) FROM masters.HsnCodes
                             WHERE Code = @Code AND IsDeleted = 0
                             AND (@ExcludeId IS NULL OR Id <> @ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Code = code, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(HsnCode e)
    {
        const string sql = @"
            INSERT INTO masters.HsnCodes (Code, Description, GstPercent, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code, @Description, @GstPercent, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(HsnCode e)
    {
        const string sql = @"
            UPDATE masters.HsnCodes SET
                Code = @Code, Description = @Description, GstPercent = @GstPercent,
                IsActive = @IsActive, UpdatedAt = @UpdatedAt, UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.HsnCodes SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    public async Task<List<HsnCodeDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Code, Description, GstPercent FROM masters.HsnCodes WHERE IsDeleted=0 AND IsActive=1 ORDER BY Code";
        using var conn = db.Create();
        return (await conn.QueryAsync<HsnCodeDropdownDto>(sql)).ToList();
    }

    private static (string clause, DynamicParameters param) BuildWhere(HsnCodeFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(Code LIKE @Search OR Description LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (f.IsActive.HasValue) { parts.Add("IsActive = @IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "Code", "GstPercent", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
