using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class StockCategoryRepository(DbConnectionFactory db) : IStockCategoryRepository
{
    private const string SelectCols = @"
        sc.Id, sc.Code, sc.Name,
        sc.GsmType, sc.Gsm, sc.GsmMin, sc.GsmMax, sc.IsActive, sc.CreatedAt";

    public async Task<PagedResult<StockCategoryListDto>> GetAllAsync(StockCategoryFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "sc.Name") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM masters.StockCategories sc WHERE {where}";
        var dataSql  = $@"
            SELECT {SelectCols}
            FROM   masters.StockCategories sc
            WHERE  {where}
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<StockCategoryListDto>(dataSql, param)).ToList();
        return new PagedResult<StockCategoryListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<StockCategoryListDto>> GetAllForExportAsync(StockCategoryFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "sc.Name") + " " + f.SafeSortOrder;
        var sql = $@"
            SELECT {SelectCols}
            FROM   masters.StockCategories sc
            WHERE  {where} ORDER BY {orderBy}";
        using var conn = db.Create();
        return (await conn.QueryAsync<StockCategoryListDto>(sql, param)).ToList();
    }

    public async Task<StockCategoryDetailDto?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT sc.Id, sc.Code, sc.Name,
                   sc.GsmType, sc.Gsm, sc.GsmMin, sc.GsmMax, sc.IsActive, sc.CreatedAt,
                   sc.UpdatedAt, sc.UpdatedBy
            FROM   masters.StockCategories sc
            WHERE  sc.Id = @Id AND sc.IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<StockCategoryDetailDto>(sql, new { id });
    }

    public async Task<List<StockCategoryDropdownDto>> GetDropdownAsync(int? stockGroupId = null)
    {
        const string sql = @"
            SELECT sc.Id, sc.Code, sc.Name
            FROM   masters.StockCategories sc
            WHERE  sc.IsDeleted = 0 AND sc.IsActive = 1
            ORDER  BY sc.Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<StockCategoryDropdownDto>(sql)).ToList();
    }

    public async Task<bool> CodeExistsAsync(string code, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM masters.StockCategories WHERE Code = @Code AND IsDeleted = 0 AND (@ExcludeId IS NULL OR Id <> @ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Code = code, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(StockCategory e)
    {
        const string sql = @"
            INSERT INTO masters.StockCategories
                (Code, Name, GsmType, Gsm, GsmMin, GsmMax, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code, @Name, @GsmType, @Gsm, @GsmMin, @GsmMax, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(StockCategory e)
    {
        const string sql = @"
            UPDATE masters.StockCategories SET
                Code = @Code, Name = @Name, GsmType = @GsmType,
                Gsm = @Gsm, GsmMin = @GsmMin, GsmMax = @GsmMax,
                IsActive = @IsActive, UpdatedAt = @UpdatedAt, UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.StockCategories SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    public async Task<List<StockCategoryDetailDto>> BulkCreateAsync(List<StockCategory> entities)
    {
        var ids = new List<int>();
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();
        const string sql = @"
            INSERT INTO masters.StockCategories
                (Code, Name, GsmType, Gsm, GsmMin, GsmMax, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code, @Name, @GsmType, @Gsm, @GsmMin, @GsmMax, @IsActive, @CreatedAt, @CreatedBy)";
        foreach (var e in entities)
            ids.Add(await conn.ExecuteScalarAsync<int>(sql, e, tx));
        tx.Commit();

        const string fetchSql = @"
            SELECT sc.Id, sc.Code, sc.Name,
                   sc.GsmType, sc.Gsm, sc.GsmMin, sc.GsmMax, sc.IsActive, sc.CreatedAt,
                   sc.UpdatedAt, sc.UpdatedBy
            FROM   masters.StockCategories sc
            WHERE  sc.Id IN @Ids";
        return (await conn.QueryAsync<StockCategoryDetailDto>(fetchSql, new { Ids = ids })).ToList();
    }

    private static (string clause, DynamicParameters param) BuildWhere(StockCategoryFilterRequest f)
    {
        var parts = new List<string> { "sc.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("(sc.Name LIKE @Search OR sc.Code LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue)                  { parts.Add("sc.IsActive = @IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "sc.Id", "sc.Code", "sc.Name", "sc.IsActive", "sc.CreatedAt" };
    private static string SafeColumn(string? col, string def)
        => AllowedSort.Contains("sc." + (col ?? "")) ? "sc." + col! : def;
}
