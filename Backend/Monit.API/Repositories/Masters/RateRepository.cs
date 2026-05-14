using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class RateRepository(DbConnectionFactory db) : IRateRepository
{
    // CTE returns only the latest rate per (MQGId, RateType, RateCategory, CustomerId) combo
    private const string CurrentRatesCte = @"
        WITH Ranked AS (
            SELECT r.Id, r.MQGId,
                   m.Code   AS MQGCode,
                   CONCAT(ml.Name, ' / ', sg.Name, ' / ', m.GsmMin, N'–', m.GsmMax, 'g') AS MQGLabel,
                   ml.Id    AS MillId,   ml.Code  AS MillCode,    ml.Name  AS MillName,
                   sg.Id    AS QualityId, sg.Name AS QualityName, sg.Alias AS BrandName,
                   m.GsmMin, m.GsmMax, m.[Type] AS [Type],
                   r.RateType, r.RateCategory,
                   r.CustomerId, c.Name AS CustomerName,
                   r.[Rate] AS Amount, r.Discount,
                   CONVERT(NVARCHAR(10), r.EffectiveFrom, 23) AS EffectiveFrom,
                   r.IsActive, r.CreatedAt,
                   ROW_NUMBER() OVER (
                       PARTITION BY r.MQGId, r.RateType, r.RateCategory, r.CustomerId
                       ORDER BY r.EffectiveFrom DESC, r.Id DESC
                   ) AS rn
            FROM   masters.Rates r
            JOIN   masters.MillQualityGsm  m  ON m.Id  = r.MQGId
            JOIN   masters.Mills           ml ON ml.Id = m.MillId
            JOIN   masters.StockSubGroups  sg ON sg.Id = m.QualityId
            LEFT JOIN masters.Customers    c  ON c.Id  = r.CustomerId
            WHERE  r.IsDeleted = 0
        )";

    public async Task<PagedResult<RateListDto>> GetCurrentRatesAsync(RateFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeCol(f.SortBy, "EffectiveFrom") + " DESC";
        var countSql = $"{CurrentRatesCte} SELECT COUNT(*) FROM Ranked WHERE rn=1 AND {where}";
        var dataSql  = $"{CurrentRatesCte} SELECT Id,MQGId,BrandName,MQGCode,MQGLabel,MillId,MillCode,MillName,QualityId,QualityName,GsmMin,GsmMax,[Type] AS Type,RateType,RateCategory,CustomerId,CustomerName,Amount,Discount,EffectiveFrom,IsActive,CreatedAt FROM Ranked WHERE rn=1 AND {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset);
        param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<RateListDto>(dataSql, param)).ToList();
        return new PagedResult<RateListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<RateListDto>> GetAllForExportAsync(RateFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"{CurrentRatesCte} SELECT Id,MQGId,BrandName,MQGCode,MQGLabel,MillId,MillCode,MillName,QualityId,QualityName,GsmMin,GsmMax,[Type] AS Type,RateType,RateCategory,CustomerId,CustomerName,Amount,Discount,EffectiveFrom,IsActive,CreatedAt FROM Ranked WHERE rn=1 AND {where} ORDER BY MQGCode, RateType, CustomerName";
        using var conn = db.Create();
        return (await conn.QueryAsync<RateListDto>(sql, param)).ToList();
    }

    public async Task<List<RateHistoryDto>> GetHistoryAsync(int rateId)
    {
        const string sql = @"
            SELECT h.Id, h.[Rate] AS Amount,
                   CONVERT(NVARCHAR(10), h.EffectiveFrom, 23) AS EffectiveFrom,
                   h.CreatedAt, h.CreatedBy
            FROM   masters.Rates h
            JOIN   masters.Rates ref ON ref.Id = @RateId
              AND  h.MQGId       = ref.MQGId
              AND  h.RateType    = ref.RateType
              AND  (h.RateCategory = ref.RateCategory OR (h.RateCategory IS NULL AND ref.RateCategory IS NULL))
              AND  (h.CustomerId   = ref.CustomerId   OR (h.CustomerId   IS NULL AND ref.CustomerId   IS NULL))
            WHERE  h.IsDeleted = 0
            ORDER BY h.EffectiveFrom DESC, h.Id DESC";
        using var conn = db.Create();
        return (await conn.QueryAsync<RateHistoryDto>(sql, new { RateId = rateId })).ToList();
    }

    public async Task<List<SORateDto>> GetForCustomerAsync(int customerId)
    {
        // Returns materialId → {rate, discount} using the latest active sale rate
        // matched by mill + quality + GSM range + packing type
        const string sql = @"
            WITH Ranked AS (
                SELECT r.MQGId, r.[Rate] AS Rate, ISNULL(r.Discount,0) AS Discount,
                       m.MillId, m.QualityId, m.GsmMin, m.GsmMax, m.[Type],
                       ROW_NUMBER() OVER (
                           PARTITION BY r.MQGId
                           ORDER BY
                               CASE WHEN r.CustomerId = @CustomerId THEN 0 ELSE 1 END,
                               r.EffectiveFrom DESC, r.Id DESC
                       ) AS rn
                FROM   masters.Rates           r
                JOIN   masters.MillQualityGsm  m ON m.Id = r.MQGId
                WHERE  r.RateType = 'Sale'
                  AND  (r.CustomerId = @CustomerId OR r.CustomerId IS NULL)
                  AND  r.IsDeleted  = 0
                  AND  r.IsActive   = 1
            )
            SELECT mat.Id AS MaterialId, rnk.Rate, rnk.Discount
            FROM   masters.Materials mat
            JOIN   Ranked            rnk
                ON  rnk.rn        = 1
                AND rnk.MillId    = mat.MillId
                AND rnk.QualityId = mat.QualityId
                AND mat.GSM BETWEEN rnk.GsmMin AND rnk.GsmMax
                AND (
                    (mat.PackingType IN ('Sheet','Packet','Bundle','Box') AND rnk.[Type] = 'Sheet')
                    OR (mat.PackingType = 'Reel' AND rnk.[Type] = 'Reel')
                )
            WHERE  mat.IsDeleted = 0 AND mat.IsActive = 1";
        using var conn = db.Create();
        return (await conn.QueryAsync<SORateDto>(sql, new { CustomerId = customerId })).ToList();
    }

    public async Task<int> CreateAsync(Rate e)
    {
        const string sql = @"
            INSERT INTO masters.Rates
                (MQGId,RateType,RateCategory,CustomerId,[Rate],Discount,EffectiveFrom,IsActive,CreatedAt,CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@MQGId,@RateType,@RateCategory,@CustomerId,@Amount,@Discount,@EffectiveFrom,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, e);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Rates SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static (string, DynamicParameters) BuildWhere(RateFilterRequest f)
    {
        var parts = new List<string>();
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.RateType)) { parts.Add("RateType=@RateType"); p.Add("RateType", f.RateType.Trim()); }
        if (f.MillId.HasValue)     { parts.Add("MillId=@MillId");       p.Add("MillId",    f.MillId.Value); }
        if (f.MQGId.HasValue)      { parts.Add("MQGId=@MQGId");         p.Add("MQGId",     f.MQGId.Value); }
        if (f.CustomerId.HasValue) { parts.Add("CustomerId=@CustomerId"); p.Add("CustomerId", f.CustomerId.Value); }
        if (!string.IsNullOrWhiteSpace(f.RateCategory)) { parts.Add("RateCategory=@RateCategory"); p.Add("RateCategory", f.RateCategory.Trim()); }
        if (f.IsActive.HasValue)   { parts.Add("IsActive=@IsActive");    p.Add("IsActive",  f.IsActive.Value); }
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("(MQGCode LIKE @Search OR CustomerName LIKE @Search OR MillName LIKE @Search)");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        return (parts.Count > 0 ? string.Join(" AND ", parts) : "1=1", p);
    }

    private static readonly HashSet<string> AllowedCols = new(StringComparer.OrdinalIgnoreCase)
        { "MQGCode", "RateType", "RateCategory", "CustomerName", "Amount", "EffectiveFrom", "IsActive", "CreatedAt" };

    private static string SafeCol(string? col, string def)
        => col != null && AllowedCols.Contains(col) ? col : def;
}
