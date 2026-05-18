using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class StockGroupRepository(DbConnectionFactory db) : IStockGroupRepository
{
    private const string SubgroupJoin = @"
        LEFT JOIN masters.StockSubGroups ssg ON ssg.StockGroupId = sg.Id AND ssg.IsDeleted = 0";

    // Each record: id\x1Fname\x1Falias   |   records separated by \x1E
    private const string SubgroupAgg =
        "STRING_AGG(CONCAT(CAST(ssg.Id AS NVARCHAR(10)), CHAR(31), ssg.Name, CHAR(31), ISNULL(ssg.Alias, '')), CHAR(30)) WITHIN GROUP (ORDER BY ssg.Id) AS SubgroupsCsv";

    public async Task<PagedResult<StockGroupListDto>> GetAllAsync(StockGroupFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "sg.Name") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM masters.StockGroups sg WHERE {where}";
        var dataSql  = $@"
            SELECT sg.Id, sg.Name, sg.Description, sg.IsActive, sg.CreatedAt,
                   {SubgroupAgg}
            FROM   masters.StockGroups sg
            {SubgroupJoin}
            WHERE  {where}
            GROUP  BY sg.Id, sg.Name, sg.Description, sg.IsActive, sg.CreatedAt
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<StockGroupListDto>(dataSql, param)).ToList();
        return new PagedResult<StockGroupListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<StockGroupListDto>> GetAllForExportAsync(StockGroupFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "sg.Name") + " " + f.SafeSortOrder;
        var sql = $@"
            SELECT sg.Id, sg.Name, sg.Description, sg.IsActive, sg.CreatedAt,
                   {SubgroupAgg}
            FROM   masters.StockGroups sg
            {SubgroupJoin}
            WHERE  {where}
            GROUP  BY sg.Id, sg.Name, sg.Description, sg.IsActive, sg.CreatedAt
            ORDER  BY {orderBy}";
        using var conn = db.Create();
        return (await conn.QueryAsync<StockGroupListDto>(sql, param)).ToList();
    }

    public async Task<StockGroupDetailDto?> GetByIdAsync(int id)
    {
        var sql = $@"
            SELECT sg.Id, sg.Name, sg.Description, sg.IsActive, sg.CreatedAt, sg.UpdatedAt, sg.UpdatedBy,
                   {SubgroupAgg}
            FROM   masters.StockGroups sg
            LEFT JOIN masters.StockSubGroups ssg ON ssg.StockGroupId = sg.Id AND ssg.IsDeleted = 0
            WHERE  sg.Id = @Id AND sg.IsDeleted = 0
            GROUP  BY sg.Id, sg.Name, sg.Description, sg.IsActive, sg.CreatedAt, sg.UpdatedAt, sg.UpdatedBy";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<StockGroupDetailDto>(sql, new { id });
    }

    public async Task<List<StockGroupDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Name FROM masters.StockGroups WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<StockGroupDropdownDto>(sql)).ToList();
    }

    public async Task<List<SubGroupDropdownDto>> GetSubGroupsDropdownAsync()
    {
        const string sql = @"
            SELECT ssg.Id, ssg.StockGroupId AS GroupId, sg.Name AS GroupName, ssg.Name, ssg.Alias
            FROM   masters.StockSubGroups ssg
            JOIN   masters.StockGroups    sg  ON sg.Id = ssg.StockGroupId AND sg.IsDeleted = 0
            WHERE  ssg.IsDeleted = 0
            ORDER  BY sg.Name, ssg.Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<SubGroupDropdownDto>(sql)).ToList();
    }

    public async Task<bool> NameExistsAsync(string name, int? excludeId = null)
    {
        const string sql = @"SELECT COUNT(1) FROM masters.StockGroups WHERE Name = @Name AND IsDeleted = 0
                             AND (@ExcludeId IS NULL OR Id <> @ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Name = name, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(StockGroup e, List<SubgroupInputDto> subgroups)
    {
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();

        const string insertGroup = @"
            INSERT INTO masters.StockGroups (Name, Description, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Name, @Description, @IsActive, @CreatedAt, @CreatedBy)";

        var id = await conn.ExecuteScalarAsync<int>(insertGroup, e, tx);

        await InsertSubgroups(conn, tx, id, subgroups, e.CreatedBy);

        tx.Commit();
        return id;
    }

    public async Task UpdateAsync(StockGroup e, List<SubgroupInputDto> subgroups)
    {
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();

        const string updateGroup = @"
            UPDATE masters.StockGroups SET
                Name = @Name, Description = @Description, IsActive = @IsActive,
                UpdatedAt = @UpdatedAt, UpdatedBy = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";

        await conn.ExecuteAsync(updateGroup, e, tx);

        const string deleteOld = "UPDATE masters.StockSubGroups SET IsDeleted=1 WHERE StockGroupId=@Id AND IsDeleted=0";
        await conn.ExecuteAsync(deleteOld, new { e.Id }, tx);

        await InsertSubgroups(conn, tx, e.Id, subgroups, e.UpdatedBy ?? e.CreatedBy);

        tx.Commit();
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.StockGroups SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static async Task InsertSubgroups(
        System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx,
        int groupId,
        List<SubgroupInputDto> subgroups,
        string createdBy)
    {
        if (subgroups.Count == 0) return;
        const string sql = @"
            INSERT INTO masters.StockSubGroups (StockGroupId, Name, Alias, CreatedAt, CreatedBy)
            VALUES (@StockGroupId, @Name, @Alias, GETUTCDATE(), @CreatedBy)";
        foreach (var s in subgroups.Where(s => !string.IsNullOrWhiteSpace(s.Name)))
            await conn.ExecuteAsync(sql, new { StockGroupId = groupId, Name = s.Name.Trim(), Alias = s.Alias?.Trim(), CreatedBy = createdBy }, tx);
    }

    private static (string clause, DynamicParameters param) BuildWhere(StockGroupFilterRequest f)
    {
        var parts = new List<string> { "sg.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            parts.Add("sg.Name LIKE @Search");
            p.Add("Search", $"%{f.Search.Trim()}%");
        }
        if (f.IsActive.HasValue) { parts.Add("sg.IsActive = @IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "sg.Id", "sg.Name", "sg.IsActive", "sg.CreatedAt" };
    private static string SafeColumn(string? col, string def)
        => AllowedSort.Contains("sg." + (col ?? "")) ? "sg." + col! : def;
}
