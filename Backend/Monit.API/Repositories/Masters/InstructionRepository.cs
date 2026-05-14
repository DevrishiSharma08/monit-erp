using System.Data;
using System.Text.Json;
using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class InstructionRepository(DbConnectionFactory db) : IInstructionRepository
{
    private class RawRow
    {
        public int       Id           { get; set; }
        public string?   Title        { get; set; }
        public string    ApplicableTo { get; set; } = "All";
        public string?   LinesJson    { get; set; }
        public string?   MillIdsRaw   { get; set; }
        public bool      IsActive     { get; set; }
        public DateTime  CreatedAt    { get; set; }
        public DateTime? UpdatedAt    { get; set; }
        public string?   UpdatedBy    { get; set; }
    }

    private static List<string> ParseLines(string? json) =>
        JsonSerializer.Deserialize<List<string>>(json ?? "[]") ?? [];

    private static List<int> ParseMillIds(string? raw) =>
        string.IsNullOrEmpty(raw) ? [] : raw.Split(',').Select(int.Parse).ToList();

    private static InstructionListDto ToList(RawRow r) => new()
    {
        Id = r.Id, Title = r.Title, ApplicableTo = r.ApplicableTo,
        Lines = ParseLines(r.LinesJson), MillIds = ParseMillIds(r.MillIdsRaw),
        IsActive = r.IsActive, CreatedAt = r.CreatedAt,
    };

    private static InstructionDetailDto ToDetail(RawRow r) => new()
    {
        Id = r.Id, Title = r.Title, ApplicableTo = r.ApplicableTo,
        Lines = ParseLines(r.LinesJson), MillIds = ParseMillIds(r.MillIdsRaw),
        IsActive = r.IsActive, CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt, UpdatedBy = r.UpdatedBy,
    };

    private static InstructionDropdownDto ToDropdown(RawRow r) => new()
    {
        Id = r.Id, Title = r.Title, ApplicableTo = r.ApplicableTo,
        Lines = ParseLines(r.LinesJson), MillIds = ParseMillIds(r.MillIdsRaw),
    };

    // ─── Shared SQL fragments ────────────────────────────────────────────────

    private const string ListSelect = @"
        i.Id, i.Title, i.ApplicableTo, i.LinesJson,
        STRING_AGG(CAST(im.MillId AS NVARCHAR(10)), ',') AS MillIdsRaw,
        i.IsActive, i.CreatedAt";

    private const string DetailSelect = @"
        i.Id, i.Title, i.ApplicableTo, i.LinesJson,
        STRING_AGG(CAST(im.MillId AS NVARCHAR(10)), ',') AS MillIdsRaw,
        i.IsActive, i.CreatedAt, i.UpdatedAt, i.UpdatedBy";

    private const string BaseJoin =
        "FROM masters.Instructions i LEFT JOIN masters.InstructionMills im ON im.InstructionId = i.Id";

    private const string ListGroup =
        "GROUP BY i.Id, i.Title, i.ApplicableTo, i.LinesJson, i.IsActive, i.CreatedAt";

    private const string DetailGroup =
        "GROUP BY i.Id, i.Title, i.ApplicableTo, i.LinesJson, i.IsActive, i.CreatedAt, i.UpdatedAt, i.UpdatedBy";

    // ─── Query methods ───────────────────────────────────────────────────────

    public async Task<PagedResult<InstructionListDto>> GetAllAsync(InstructionFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy  = SafeColumn(f.SortBy, "i.Title") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Instructions i WHERE {where}";
        var dataSql  = $"SELECT {ListSelect} {BaseJoin} WHERE {where} {ListGroup} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var rows  = (await conn.QueryAsync<RawRow>(dataSql, param)).ToList();
        return new PagedResult<InstructionListDto>
        {
            Items = rows.Select(ToList).ToList(),
            Page  = f.Page, PageSize = f.PageSize, Total = total
        };
    }

    public async Task<List<InstructionListDto>> GetAllForExportAsync(InstructionFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "i.Title") + " " + f.SafeSortOrder;
        var sql = $"SELECT {ListSelect} {BaseJoin} WHERE {where} {ListGroup} ORDER BY {orderBy}";
        using var conn = db.Create();
        return (await conn.QueryAsync<RawRow>(sql, param)).Select(ToList).ToList();
    }

    public async Task<InstructionDetailDto?> GetByIdAsync(int id)
    {
        var sql = $"SELECT {DetailSelect} {BaseJoin} WHERE i.Id = @Id AND i.IsDeleted = 0 {DetailGroup}";
        using var conn = db.Create();
        var r = await conn.QueryFirstOrDefaultAsync<RawRow>(sql, new { Id = id });
        return r is null ? null : ToDetail(r);
    }

    public async Task<List<InstructionDropdownDto>> GetDropdownAsync()
    {
        var sql = $"SELECT {ListSelect} {BaseJoin} WHERE i.IsDeleted = 0 AND i.IsActive = 1 {ListGroup} ORDER BY i.Title";
        using var conn = db.Create();
        return (await conn.QueryAsync<RawRow>(sql)).Select(ToDropdown).ToList();
    }

    public async Task<List<InstructionDropdownDto>> GetByMillAsync(int? millId)
    {
        var param = new DynamicParameters();
        var millFilter = string.Empty;
        if (millId.HasValue)
        {
            millFilter = "AND (i.ApplicableTo = 'All' OR EXISTS (SELECT 1 FROM masters.InstructionMills x WHERE x.InstructionId = i.Id AND x.MillId = @MillId))";
            param.Add("MillId", millId.Value);
        }
        var sql = $"SELECT {ListSelect} {BaseJoin} WHERE i.IsDeleted = 0 AND i.IsActive = 1 {millFilter} {ListGroup} ORDER BY i.Title";
        using var conn = db.Create();
        return (await conn.QueryAsync<RawRow>(sql, param)).Select(ToDropdown).ToList();
    }

    // ─── Write methods (with transaction for junction table) ────────────────

    public async Task<int> CreateAsync(Instruction e, List<int> millIds)
    {
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();
        try
        {
            const string sql = @"
                INSERT INTO masters.Instructions (Title, ApplicableTo, LinesJson, IsActive, CreatedAt, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES (@Title, @ApplicableTo, @LinesJson, @IsActive, @CreatedAt, @CreatedBy)";
            var id = await conn.ExecuteScalarAsync<int>(sql, e, tx);
            await SyncMillsAsync(conn, tx, id, millIds);
            tx.Commit();
            return id;
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task UpdateAsync(Instruction e, List<int> millIds)
    {
        using var conn = db.Create();
        using var tx = conn.BeginTransaction();
        try
        {
            const string sql = @"
                UPDATE masters.Instructions SET
                    Title=@Title, ApplicableTo=@ApplicableTo, LinesJson=@LinesJson,
                    IsActive=@IsActive, UpdatedAt=@UpdatedAt, UpdatedBy=@UpdatedBy
                WHERE Id=@Id AND IsDeleted=0";
            await conn.ExecuteAsync(sql, e, tx);
            await SyncMillsAsync(conn, tx, e.Id, millIds);
            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE masters.Instructions SET IsDeleted=1, DeletedAt=GETUTCDATE(), DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static async Task SyncMillsAsync(IDbConnection conn, IDbTransaction tx, int instructionId, List<int> millIds)
    {
        await conn.ExecuteAsync("DELETE FROM masters.InstructionMills WHERE InstructionId = @Id", new { Id = instructionId }, tx);
        foreach (var millId in millIds)
            await conn.ExecuteAsync(
                "INSERT INTO masters.InstructionMills (InstructionId, MillId) VALUES (@InstructionId, @MillId)",
                new { InstructionId = instructionId, MillId = millId }, tx);
    }

    private static (string, DynamicParameters) BuildWhere(InstructionFilterRequest f)
    {
        var parts = new List<string> { "i.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("i.Title LIKE @Search"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue) { parts.Add("i.IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "Title", "ApplicableTo", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def)
    {
        if (!string.IsNullOrWhiteSpace(col) && AllowedSort.Contains(col)) return "i." + col;
        return def;
    }
}
