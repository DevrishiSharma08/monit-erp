using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class MQGRepository(DbConnectionFactory db) : IMQGRepository
{
    private const string ListSelect = @"
        SELECT m.Id, m.Code,
               m.MillId,    mi.Code  AS MillCode,     mi.Name  AS MillName,
               m.QualityId, sg.Name  AS QualityGroup, ssg.Name AS QualityName,
               m.GsmMin, m.GsmMax, m.[Type], m.IsActive, m.CreatedAt
        FROM   masters.MillQualityGsm m
        JOIN   masters.Mills           mi  ON  mi.Id  = m.MillId    AND mi.IsDeleted  = 0
        JOIN   masters.StockSubGroups  ssg ON ssg.Id  = m.QualityId AND ssg.IsDeleted = 0
        JOIN   masters.StockGroups     sg  ON  sg.Id  = ssg.StockGroupId AND sg.IsDeleted = 0";

    public async Task<PagedResult<MQGListDto>> GetAllAsync(MQGFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = "mi.Code, ssg.Name, m.GsmMin";

        var countSql = $@"SELECT COUNT(*)
            FROM   masters.MillQualityGsm m
            JOIN   masters.Mills          mi  ON mi.Id  = m.MillId    AND mi.IsDeleted  = 0
            JOIN   masters.StockSubGroups ssg ON ssg.Id = m.QualityId AND ssg.IsDeleted = 0
            WHERE  {where}";
        var dataSql  = $"{ListSelect} WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<MQGListDto>(dataSql, param)).ToList();
        return new PagedResult<MQGListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<MQGDetailDto?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT m.Id, m.Code,
                   m.MillId,    mi.Code  AS MillCode,     mi.Name  AS MillName,
                   m.QualityId, sg.Name  AS QualityGroup, ssg.Name AS QualityName,
                   m.GsmMin, m.GsmMax, m.[Type], m.IsActive, m.CreatedAt,
                   m.UpdatedAt, m.UpdatedBy
            FROM   masters.MillQualityGsm m
            JOIN   masters.Mills           mi  ON  mi.Id  = m.MillId    AND mi.IsDeleted  = 0
            JOIN   masters.StockSubGroups  ssg ON ssg.Id  = m.QualityId AND ssg.IsDeleted = 0
            JOIN   masters.StockGroups     sg  ON  sg.Id  = ssg.StockGroupId AND sg.IsDeleted = 0
            WHERE  m.Id = @Id AND m.IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<MQGDetailDto>(sql, new { id });
    }

    public async Task<bool> ComboExistsAsync(int millId, int qualityId, int gsmMin, int gsmMax, string type, int? excludeId = null)
    {
        const string sql = @"SELECT COUNT(1) FROM masters.MillQualityGsm
                             WHERE MillId=@MillId AND QualityId=@QualityId
                               AND GsmMin=@GsmMin AND GsmMax=@GsmMax AND [Type]=@Type
                               AND IsDeleted=0
                               AND (@ExcludeId IS NULL OR Id <> @ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql,
            new { MillId = millId, QualityId = qualityId, GsmMin = gsmMin, GsmMax = gsmMax, Type = type, ExcludeId = excludeId }) > 0;
    }

    public async Task<int?> GetIdByComboAsync(int millId, int qualityId, int gsmMin, int gsmMax, string type)
    {
        const string sql = @"SELECT TOP 1 Id FROM masters.MillQualityGsm
                             WHERE MillId=@MillId AND QualityId=@QualityId
                               AND GsmMin=@GsmMin AND GsmMax=@GsmMax AND [Type]=@Type
                               AND IsDeleted=0";
        using var conn = db.Create();
        var id = await conn.QueryFirstOrDefaultAsync<int>(sql,
            new { MillId = millId, QualityId = qualityId, GsmMin = gsmMin, GsmMax = gsmMax, Type = type });
        return id == 0 ? null : id;
    }

    public async Task<(string MillCode, string QualityName)> GetCodePartsAsync(int millId, int qualityId)
    {
        const string sql = @"SELECT mi.Code AS MillCode, ssg.Name AS QualityName
                             FROM   masters.Mills mi
                             CROSS JOIN masters.StockSubGroups ssg
                             WHERE  mi.Id = @MillId AND ssg.Id = @QualityId";
        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync<(string MillCode, string QualityName)>(
            sql, new { MillId = millId, QualityId = qualityId });
        return row;
    }

    public async Task<int> CreateAsync(MillQualityGsm e)
    {
        const string sql = @"
            INSERT INTO masters.MillQualityGsm
                (Code, MillId, QualityId, GsmMin, GsmMax, [Type], IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code, @MillId, @QualityId, @GsmMin, @GsmMax, @Type, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task UpdateAsync(MillQualityGsm e)
    {
        const string sql = @"
            UPDATE masters.MillQualityGsm SET
                Code = @Code, MillId = @MillId, QualityId = @QualityId,
                GsmMin = @GsmMin, GsmMax = @GsmMax, [Type] = @Type,
                IsActive = @IsActive, UpdatedAt = @UpdatedAt, UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.MillQualityGsm SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    public async Task<List<MQGDropdownDto>> GetDropdownAsync()
    {
        const string sql = @"
            SELECT m.Id, m.Code,
                   mi.Code + ' - ' + ssg.Name + ' ' + CAST(m.GsmMin AS NVARCHAR) + '-' + CAST(m.GsmMax AS NVARCHAR) + ' ' + m.[Type] AS Label,
                   m.MillId, m.QualityId, m.GsmMin, m.GsmMax, m.[Type]
            FROM   masters.MillQualityGsm m
            JOIN   masters.Mills          mi  ON mi.Id  = m.MillId    AND mi.IsDeleted  = 0
            JOIN   masters.StockSubGroups ssg ON ssg.Id = m.QualityId AND ssg.IsDeleted = 0
            WHERE  m.IsDeleted = 0 AND m.IsActive = 1
            ORDER  BY mi.Code, ssg.Name, m.GsmMin";
        using var conn = db.Create();
        return (await conn.QueryAsync<MQGDropdownDto>(sql)).ToList();
    }

    private static (string clause, DynamicParameters param) BuildWhere(MQGFilterRequest f)
    {
        var parts = new List<string> { "m.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(m.Code LIKE @Search OR mi.Name LIKE @Search OR ssg.Name LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (f.IsActive.HasValue) { parts.Add("m.IsActive = @IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }
}
