using Dapper;
using Monit.API.Data;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class AuthRepository(DbConnectionFactory db) : IAuthRepository
{
    public async Task<User?> GetByUsernameAsync(string username, int companyId)
    {
        const string sql = @"
            SELECT u.Id, u.Username, u.Email, u.Password, u.Name, u.RoleId, u.Role,
                   u.CustomerName, u.IsActive, u.LastLoginAt, u.RefreshToken, u.RefreshTokenExpiry,
                   r.Permissions AS PermissionsJson
            FROM   auth.Users u
            LEFT JOIN auth.Roles r ON r.Id = u.RoleId
            WHERE  (u.Username = @Username OR u.Email = @Username) AND u.IsDeleted = 0";

        using var conn = db.CreateForCompany(companyId);
        return await conn.QueryFirstOrDefaultAsync<User>(sql, new { Username = username });
    }

    public async Task<User?> GetByIdAsync(int id, int companyId)
    {
        const string sql = @"
            SELECT u.Id, u.Username, u.Email, u.Password, u.Name, u.RoleId, u.Role,
                   u.CustomerName, u.IsActive, u.LastLoginAt, u.RefreshToken, u.RefreshTokenExpiry,
                   r.Permissions AS PermissionsJson
            FROM   auth.Users u
            LEFT JOIN auth.Roles r ON r.Id = u.RoleId
            WHERE  u.Id = @Id AND u.IsDeleted = 0";

        using var conn = db.CreateForCompany(companyId);
        return await conn.QueryFirstOrDefaultAsync<User>(sql, new { Id = id });
    }

    public async Task<User?> GetByRefreshTokenAsync(string refreshToken, int companyId)
    {
        const string sql = @"
            SELECT u.Id, u.Username, u.Email, u.Password, u.Name, u.RoleId, u.Role,
                   u.CustomerName, u.IsActive, u.RefreshToken, u.RefreshTokenExpiry,
                   r.Permissions AS PermissionsJson
            FROM   auth.Users u
            LEFT JOIN auth.Roles r ON r.Id = u.RoleId
            WHERE  u.RefreshToken = @Token
              AND  u.RefreshTokenExpiry > GETUTCDATE()
              AND  u.IsDeleted = 0";

        using var conn = db.CreateForCompany(companyId);
        return await conn.QueryFirstOrDefaultAsync<User>(sql, new { Token = refreshToken });
    }

    public async Task SaveRefreshTokenAsync(int userId, string token, DateTime expiry, int companyId)
    {
        const string sql = @"
            UPDATE auth.Users SET
                RefreshToken       = @Token,
                RefreshTokenExpiry = @Expiry,
                UpdatedAt          = GETUTCDATE()
            WHERE Id = @UserId";

        using var conn = db.CreateForCompany(companyId);
        await conn.ExecuteAsync(sql, new { UserId = userId, Token = token, Expiry = expiry });
    }

    public async Task RevokeRefreshTokenAsync(int userId, int companyId)
    {
        const string sql = @"
            UPDATE auth.Users SET
                RefreshToken       = NULL,
                RefreshTokenExpiry = NULL,
                UpdatedAt          = GETUTCDATE()
            WHERE Id = @UserId";

        using var conn = db.CreateForCompany(companyId);
        await conn.ExecuteAsync(sql, new { UserId = userId });
    }

    public async Task UpdatePasswordAsync(int userId, string password, string updatedBy, int companyId)
    {
        const string sql = @"
            UPDATE auth.Users SET
                Password  = @Password,
                UpdatedAt = GETUTCDATE(),
                UpdatedBy = @UpdatedBy
            WHERE Id = @UserId";

        using var conn = db.CreateForCompany(companyId);
        await conn.ExecuteAsync(sql, new { UserId = userId, Password = password, UpdatedBy = updatedBy });
    }

    public async Task UpdateLastLoginAsync(int userId, int companyId)
    {
        const string sql = "UPDATE auth.Users SET LastLoginAt = GETUTCDATE() WHERE Id = @UserId";
        using var conn = db.CreateForCompany(companyId);
        await conn.ExecuteAsync(sql, new { UserId = userId });
    }
}
