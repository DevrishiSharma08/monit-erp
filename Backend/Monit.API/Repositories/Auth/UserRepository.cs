using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Auth;

public class UserRepository(DbConnectionFactory db) : IUserRepository
{
    public async Task<PagedResult<UserListDto>> GetAllAsync(UserFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "u.Name") + " " + f.SafeSortOrder;

        var countSql = $"SELECT COUNT(*) FROM auth.Users u WHERE {where}";
        var dataSql  = $@"
            SELECT u.Id, u.Username, u.Name, u.Email, u.RoleId, u.Role,
                   u.IsActive, u.LastLoginAt, u.CreatedAt
            FROM   auth.Users u
            WHERE  {where}
            ORDER  BY {orderBy}
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        param.Add("Offset",   f.Offset);
        param.Add("PageSize", f.PageSize);

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<UserListDto>(dataSql, param)).ToList();
        return new PagedResult<UserListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<UserListDto>> GetAllForExportAsync(UserFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"SELECT u.Id, u.Username, u.Name, u.Email, u.RoleId, u.Role, u.IsActive, u.LastLoginAt, u.CreatedAt FROM auth.Users u WHERE {where} ORDER BY u.Name ASC";
        using var conn = db.Create();
        return (await conn.QueryAsync<UserListDto>(sql, param)).ToList();
    }

    public async Task<UserDetailDto?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT u.Id, u.Username, u.Name, u.Email, u.RoleId, u.Role,
                   u.CustomerName, u.IsActive, u.LastLoginAt,
                   u.CreatedAt, u.CreatedBy, u.UpdatedAt, u.UpdatedBy
            FROM   auth.Users u
            WHERE  u.Id = @Id AND u.IsDeleted = 0";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<UserDetailDto>(sql, new { id });
    }

    public async Task<List<UserDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id, Username, Name, Role FROM auth.Users WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<UserDropdownDto>(sql)).ToList();
    }

    public async Task<bool> UsernameExistsAsync(string username, int? excludeId = null)
    {
        const string sql = "SELECT COUNT(1) FROM auth.Users WHERE Username=@Username AND IsDeleted=0 AND (@ExcludeId IS NULL OR Id<>@ExcludeId)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new { Username = username, ExcludeId = excludeId }) > 0;
    }

    public async Task<int> CreateAsync(User u)
    {
        const string sql = @"
            INSERT INTO auth.Users
                (Username, Email, Password, Name, RoleId, Role, CustomerName, IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@Username, @Email, @Password, @Name, @RoleId, @Role, @CustomerName, @IsActive, @CreatedAt, @CreatedBy)";
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, u);
    }

    public async Task UpdateAsync(User u)
    {
        const string sql = @"
            UPDATE auth.Users SET
                Name         = @Name,
                Email        = @Email,
                RoleId       = @RoleId,
                Role         = @Role,
                CustomerName = @CustomerName,
                IsActive     = @IsActive,
                UpdatedAt    = @UpdatedAt,
                UpdatedBy    = @UpdatedBy
            WHERE Id = @Id AND IsDeleted = 0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, u);
    }

    public async Task UpdatePasswordAsync(int id, string password, string updatedBy)
    {
        const string sql = "UPDATE auth.Users SET Password=@Password, UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, Password = password, UpdatedBy = updatedBy });
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        const string sql = "UPDATE auth.Users SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@DeletedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { Id = id, DeletedBy = deletedBy });
    }

    private static (string, DynamicParameters) BuildWhere(UserFilterRequest f)
    {
        var parts = new List<string> { "u.IsDeleted = 0" };
        var p     = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("(u.Name LIKE @Search OR u.Username LIKE @Search OR u.Email LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.RoleId.HasValue)                    { parts.Add("u.RoleId=@RoleId"); p.Add("RoleId", f.RoleId.Value); }
        if (!string.IsNullOrWhiteSpace(f.Role))   { parts.Add("u.Role=@Role");     p.Add("Role", f.Role); }
        if (f.IsActive.HasValue)                   { parts.Add("u.IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "u.Id", "u.Username", "u.Name", "u.Role", "u.IsActive", "u.LastLoginAt", "u.CreatedAt" };
    private static string SafeColumn(string? col, string def)
        => AllowedSort.Contains("u." + (col ?? "")) ? "u." + col! : def;
}
