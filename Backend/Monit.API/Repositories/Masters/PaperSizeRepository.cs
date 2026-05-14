using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class PaperSizeRepository(DbConnectionFactory db) : IPaperSizeRepository
{
    public async Task<PagedResult<PaperSizeListDto>> GetAllAsync(PaperSizeFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "SortOrder") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.PaperSizes WHERE {where}";
        var dataSql  = $"SELECT Id,Label,WidthMM,HeightMM,IsCustom,SortOrder,IsActive,CreatedAt FROM masters.PaperSizes WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<PaperSizeListDto>(dataSql, param)).ToList();
        return new PagedResult<PaperSizeListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<PaperSizeListDto>> GetAllForExportAsync(PaperSizeFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"SELECT Id,Label,WidthMM,HeightMM,IsCustom,SortOrder,IsActive,CreatedAt FROM masters.PaperSizes WHERE {where} ORDER BY SortOrder ASC";
        using var conn = db.Create();
        return (await conn.QueryAsync<PaperSizeListDto>(sql, param)).ToList();
    }

    public async Task<PaperSizeDetailDto?> GetByIdAsync(int id)
    {
        const string sql = "SELECT Id,Label,WidthMM,HeightMM,IsCustom,SortOrder,IsActive,CreatedAt,UpdatedAt,UpdatedBy FROM masters.PaperSizes WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<PaperSizeDetailDto>(sql, new { id });
    }

    public async Task<List<PaperSizeDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Label FROM masters.PaperSizes WHERE IsDeleted=0 AND IsActive=1 ORDER BY SortOrder, Label";
        using var conn = db.Create();
        return (await conn.QueryAsync<PaperSizeDropdownDto>(sql)).ToList();
    }

    public async Task<bool> LabelExistsAsync(string label, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM masters.PaperSizes WHERE Label=@Label AND IsDeleted=0 AND (@ExcludeId IS NULL OR Id<>@ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Label = label, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(PaperSize e)
    {
        const string sql = "INSERT INTO masters.PaperSizes (Label,WidthMM,HeightMM,IsCustom,SortOrder,IsActive,CreatedAt,CreatedBy) OUTPUT INSERTED.Id VALUES (@Label,@WidthMM,@HeightMM,@IsCustom,@SortOrder,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(PaperSize e)
    {
        const string sql = "UPDATE masters.PaperSizes SET Label=@Label,WidthMM=@WidthMM,HeightMM=@HeightMM,IsCustom=@IsCustom,SortOrder=@SortOrder,IsActive=@IsActive,UpdatedAt=@UpdatedAt,UpdatedBy=@UpdatedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.PaperSizes SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static (string, DynamicParameters) BuildWhere(PaperSizeFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("Label LIKE @Search"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsCustom.HasValue)  { parts.Add("IsCustom=@IsCustom"); p.Add("IsCustom", f.IsCustom.Value); }
        if (f.IsActive.HasValue)  { parts.Add("IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase) { "Id", "Label", "SortOrder", "IsCustom", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
