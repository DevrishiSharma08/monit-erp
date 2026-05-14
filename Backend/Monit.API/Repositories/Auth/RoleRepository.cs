using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Auth;

public class RoleRepository(DbConnectionFactory db) : IRoleRepository
{
    public async Task<PagedResult<RoleListDto>> GetAllAsync(RoleFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "r.Name") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM auth.Roles r WHERE {where}";
        var dataSql  = $@"
            SELECT r.Id, r.Name, r.Description, r.IsActive, r.CreatedAt,
                   COUNT(u.Id) AS UserCount
            FROM   auth.Roles r
            LEFT JOIN auth.Users u ON u.RoleId = r.Id AND u.IsDeleted = 0 AND u.IsActive = 1
            WHERE  {where}
            GROUP  BY r.Id, r.Name, r.Description, r.IsActive, r.CreatedAt
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<RoleListDto>(dataSql, param)).ToList();
        return new PagedResult<RoleListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<RoleDetailDto?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT r.Id, r.Name, r.Description, r.Permissions, r.IsActive, r.CreatedAt,
                   r.UpdatedAt, r.UpdatedBy,
                   COUNT(u.Id) AS UserCount
            FROM   auth.Roles r
            LEFT JOIN auth.Users u ON u.RoleId = r.Id AND u.IsDeleted = 0
            WHERE  r.Id = @Id AND r.IsDeleted = 0
            GROUP  BY r.Id, r.Name, r.Description, r.Permissions, r.IsActive,
                      r.CreatedAt, r.UpdatedAt, r.UpdatedBy";

        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(sql, new { id });
        if (row == null) return null;

        var dto = new RoleDetailDto
        {
            Id          = row.Id,
            Name        = row.Name,
            Description = row.Description,
            IsActive    = row.IsActive,
            CreatedAt   = row.CreatedAt,
            UpdatedAt   = row.UpdatedAt,
            UpdatedBy   = row.UpdatedBy,
            UserCount   = row.UserCount,
            Permissions = ParsePermissions((string?)row.Permissions)
        };
        return dto;
    }

    public async Task<List<RoleDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Name FROM auth.Roles WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<RoleDropdownDto>(sql)).ToList();
    }

    public async Task<bool> NameExistsAsync(string name, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM auth.Roles WHERE Name=@Name AND IsDeleted=0 AND (@ExcludeId IS NULL OR Id<>@ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Name = name, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(Role r)
    {
        const string sql = @"
            INSERT INTO auth.Roles (Name, Description, Permissions, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Name, @Description, @Permissions, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, r);
    }

    public async Task UpdateAsync(Role r)
    {
        const string sql = @"
            UPDATE auth.Roles SET
                Name=@Name, Description=@Description, Permissions=@Permissions,
                IsActive=@IsActive, UpdatedAt=@UpdatedAt, UpdatedBy=@UpdatedBy
            WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, r);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE auth.Roles SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    internal static List<string> ParsePermissions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch { return []; }
    }

    private static (string, DynamicParameters) BuildWhere(RoleFilterRequest f)
    {
        var parts = new List<string> { "r.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("r.Name LIKE @Search"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue) { parts.Add("r.IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "r.Id", "r.Name", "r.IsActive", "r.CreatedAt" };
    private static string SafeColumn(string? col, string def)
        => AllowedSort.Contains("r." + (col ?? "")) ? "r." + col! : def;
}
