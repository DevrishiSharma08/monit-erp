using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class MaterialRepository(DbConnectionFactory db) : IMaterialRepository
{
    private const string SelectList = @"
        SELECT m.Id, m.Code,
               m.MillId,     ml.Code AS MillCode,   ml.Name AS MillName,
               m.QualityId,  sg.Name AS QualityName,
               m.ItemTypeId, it.Name AS ItemTypeName,
               m.GSM,
               m.SizeLength, m.SizeWidth,
               CASE WHEN m.SizeWidth IS NULL
                    THEN CAST(CAST(m.SizeLength AS INT) AS NVARCHAR(20))
                    ELSE CAST(CAST(m.SizeLength AS INT) AS NVARCHAR(20)) + 'x' + CAST(CAST(m.SizeWidth AS INT) AS NVARCHAR(20))
               END AS SizeLabel,
               m.PackingType, m.SheetsPerPacket, m.PacketsPerBundle, m.BundlesPerBox,
               sg.Alias AS BrandName,
               m.HsnCodeId, h.Code AS HsnCode, h.GstPercent, m.Grain,
               m.Description, m.IsActive, m.CreatedAt
        FROM   masters.Materials       m
        JOIN   masters.Mills           ml ON ml.Id = m.MillId
        JOIN   masters.StockSubGroups  sg ON sg.Id = m.QualityId
        JOIN   masters.ItemTypes       it ON it.Id = m.ItemTypeId
        LEFT JOIN masters.HsnCodes     h  ON h.Id  = m.HsnCodeId AND h.IsDeleted = 0";

    public async Task<PagedResult<MaterialListDto>> GetAllAsync(MaterialFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeCol(f.SortBy, "m.Code") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Materials m WHERE {where}";
        var dataSql  = $"{SelectList} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<MaterialListDto>(dataSql, param)).ToList();
        return new PagedResult<MaterialListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<MaterialListDto>> GetAllForExportAsync(MaterialFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        using var conn = db.Create();
        return (await conn.QueryAsync<MaterialListDto>($"{SelectList} WHERE {where} ORDER BY m.Code ASC", param)).ToList();
    }

    public async Task<MaterialDetailDto?> GetByIdAsync(int id)
    {
        var sql = $@"
            SELECT m.Id, m.Code,
                   m.MillId,     ml.Code AS MillCode,   ml.Name AS MillName,
                   m.QualityId,  sg.Name AS QualityName,
                   m.ItemTypeId, it.Name AS ItemTypeName,
                   m.GSM,
                   m.SizeLength, m.SizeWidth,
                   CASE WHEN m.SizeWidth IS NULL
                        THEN CAST(CAST(m.SizeLength AS INT) AS NVARCHAR(20))
                        ELSE CAST(CAST(m.SizeLength AS INT) AS NVARCHAR(20)) + 'x' + CAST(CAST(m.SizeWidth AS INT) AS NVARCHAR(20))
                   END AS SizeLabel,
                   m.PackingType, m.SheetsPerPacket, m.PacketsPerBundle, m.BundlesPerBox,
                   sg.Alias AS BrandName,
                   m.HsnCodeId, h.Code AS HsnCode, h.GstPercent, m.Grain,
                   m.Description, m.IsActive, m.CreatedAt, m.UpdatedAt, m.UpdatedBy
            FROM   masters.Materials       m
            JOIN   masters.Mills           ml ON ml.Id = m.MillId
            JOIN   masters.StockSubGroups  sg ON sg.Id = m.QualityId
            JOIN   masters.ItemTypes       it ON it.Id = m.ItemTypeId
            LEFT JOIN masters.HsnCodes     h  ON h.Id  = m.HsnCodeId AND h.IsDeleted = 0
            WHERE  m.Id = @Id AND m.IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<MaterialDetailDto>(sql, new { Id = id });
    }

    public async Task<List<MaterialDropdownDto>> GetDropdownAsync(int? millId = null, int? qualityId = null)
    {
        var where = "m.IsDeleted=0 AND m.IsActive=1";
        var p = new DynamicParameters();
        if (millId.HasValue)    { where += " AND m.MillId=@MillId";       p.Add("MillId",    millId.Value); }
        if (qualityId.HasValue) { where += " AND m.QualityId=@QualityId"; p.Add("QualityId", qualityId.Value); }
        var sql = $@"
            SELECT m.Id, m.Code,
                   m.MillId, ml.Name AS MillName, m.QualityId, sg.Name AS QualityName, it.Name AS ItemTypeName,
                   m.GSM, m.SizeLength, m.SizeWidth,
                   CASE WHEN m.SizeWidth IS NULL
                        THEN CAST(CAST(m.SizeLength AS INT) AS NVARCHAR(20))
                        ELSE CAST(CAST(m.SizeLength AS INT) AS NVARCHAR(20)) + 'x' + CAST(CAST(m.SizeWidth AS INT) AS NVARCHAR(20))
                   END AS SizeLabel,
                   m.PackingType, m.SheetsPerPacket, m.PacketsPerBundle, m.BundlesPerBox,
                   sg.Alias AS BrandName,
                   m.HsnCodeId, h.Code AS HsnCode, h.GstPercent, m.Grain
            FROM   masters.Materials       m
            JOIN   masters.Mills           ml ON ml.Id = m.MillId
            JOIN   masters.StockSubGroups  sg ON sg.Id = m.QualityId
            JOIN   masters.ItemTypes       it ON it.Id = m.ItemTypeId
            LEFT JOIN masters.HsnCodes     h  ON h.Id  = m.HsnCodeId AND h.IsDeleted = 0
            WHERE  {where}
            ORDER BY m.Code";
        using var conn = db.Create();
        return (await conn.QueryAsync<MaterialDropdownDto>(sql, p)).ToList();
    }

    public async Task<bool> CodeExistsAsync(string code, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM masters.Materials WHERE Code=@Code AND IsDeleted=0 AND (@ExcludeId IS NULL OR Id<>@ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Code = code, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(Material e)
    {
        const string sql = @"
            INSERT INTO masters.Materials
                (Code,MillId,QualityId,ItemTypeId,GSM,SizeLength,SizeWidth,
                 PackingType,SheetsPerPacket,PacketsPerBundle,BundlesPerBox,
                 HsnCodeId,Grain,Description,IsActive,CreatedAt,CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code,@MillId,@QualityId,@ItemTypeId,@GSM,@SizeLength,@SizeWidth,
                    @PackingType,@SheetsPerPacket,@PacketsPerBundle,@BundlesPerBox,
                    @HsnCodeId,@Grain,@Description,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(Material e)
    {
        const string sql = @"
            UPDATE masters.Materials SET
                Code=@Code, MillId=@MillId, QualityId=@QualityId, ItemTypeId=@ItemTypeId,
                GSM=@GSM, SizeLength=@SizeLength, SizeWidth=@SizeWidth,
                PackingType=@PackingType, SheetsPerPacket=@SheetsPerPacket,
                PacketsPerBundle=@PacketsPerBundle, BundlesPerBox=@BundlesPerBox,
                HsnCodeId=@HsnCodeId, Grain=@Grain,
                Description=@Description, IsActive=@IsActive,
                UpdatedAt=@UpdatedAt, UpdatedBy=@UpdatedBy
            WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Materials SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    public async Task<(string millCode, string qualityName, string? qualityAlias, string typeName)?> GetCodePartsAsync(int millId, int qualityId, int itemTypeId)
    {
        const string sql = @"
            SELECT ml.Code AS MillCode, sg.Name AS QualityName, sg.Alias AS QualityAlias, it.Name AS TypeName
            FROM   masters.Mills          ml
            CROSS JOIN masters.StockSubGroups sg
            CROSS JOIN masters.ItemTypes      it
            WHERE  ml.Id = @MillId     AND ml.IsDeleted = 0
              AND  sg.Id = @QualityId  AND sg.IsDeleted = 0
              AND  it.Id = @ItemTypeId AND it.IsDeleted = 0";
        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync(sql, new { MillId = millId, QualityId = qualityId, ItemTypeId = itemTypeId });
        if (row == null) return null;
        return ((string)row.MillCode, (string)row.QualityName, (string?)row.QualityAlias, (string)row.TypeName);
    }

    private static (string, DynamicParameters) BuildWhere(MaterialFilterRequest f)
    {
        var parts = new List<string> { "m.IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))  { parts.Add("m.Code LIKE @Search");       p.Add("Search",     $"%{f.Search.Trim()}%"); }
        if (f.MillId.HasValue)     { parts.Add("m.MillId=@MillId");         p.Add("MillId",     f.MillId.Value); }
        if (f.QualityId.HasValue)  { parts.Add("m.QualityId=@QualityId");   p.Add("QualityId",  f.QualityId.Value); }
        if (f.ItemTypeId.HasValue) { parts.Add("m.ItemTypeId=@ItemTypeId"); p.Add("ItemTypeId", f.ItemTypeId.Value); }
        if (f.GSM.HasValue)        { parts.Add("m.GSM=@GSM");               p.Add("GSM",        f.GSM.Value); }
        if (!string.IsNullOrWhiteSpace(f.PackingType)) { parts.Add("m.PackingType=@PackingType"); p.Add("PackingType", f.PackingType); }
        if (f.IsActive.HasValue)   { parts.Add("m.IsActive=@IsActive");     p.Add("IsActive",   f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedCols = new(StringComparer.OrdinalIgnoreCase)
        { "m.Id", "m.Code", "m.GSM", "m.IsActive", "m.CreatedAt" };
    private static string SafeCol(string? col, string def)
        => AllowedCols.Contains("m." + (col ?? "")) ? "m." + col! : def;
}
