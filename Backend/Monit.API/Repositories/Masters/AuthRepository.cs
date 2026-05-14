using Dapper;
using Monit.API.Data;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class AuthRepository(DbConnectionFactory db) : IAuthRepository
{
    public async Task<User?> GetByUsernameAsync(string username)
    {
        const string sql = @"
            SELECT Id, Username, Email, Password, Name, RoleId, Role,
                   CustomerName, IsActive, LastLoginAt, RefreshToken, RefreshTokenExpiry
            FROM auth.Users
            WHERE (Username = @Username OR Email = @Username) AND IsDeleted = 0";

        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<User>(sql, new { Username = username });
    }

    public async Task<User?> GetByIdAsync(int id)
    {
        const string sql = @"
            SELECT Id, Username, Email, Password, Name, RoleId, Role,
                   CustomerName, IsActive, LastLoginAt, RefreshToken, RefreshTokenExpiry
            FROM auth.Users
            WHERE Id = @Id AND IsDeleted = 0";

        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<User>(sql, new { Id = id });
    }

    public async Task<User?> GetByRefreshTokenAsync(string refreshToken)
    {
        const string sql = @"
            SELECT Id, Username, Email, Password, Name, RoleId, Role,
                   CustomerName, IsActive, RefreshToken, RefreshTokenExpiry
            FROM auth.Users
            WHERE RefreshToken = @Token
              AND RefreshTokenExpiry > GETUTCDATE()
              AND IsDeleted = 0";

        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<User>(sql, new { Token = refreshToken });
    }

    public async Task SaveRefreshTokenAsync(int userId, string token, DateTime expiry)
    {
        const string sql = @"
            UPDATE auth.Users SET
                RefreshToken       = @Token,
                RefreshTokenExpiry = @Expiry,
                UpdatedAt          = GETUTCDATE()
            WHERE Id = @UserId";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { UserId = userId, Token = token, Expiry = expiry });
    }

    public async Task RevokeRefreshTokenAsync(int userId)
    {
        const string sql = @"
            UPDATE auth.Users SET
                RefreshToken       = NULL,
                RefreshTokenExpiry = NULL,
                UpdatedAt          = GETUTCDATE()
            WHERE Id = @UserId";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { UserId = userId });
    }

    public async Task UpdatePasswordAsync(int userId, string password, string updatedBy)
    {
        const string sql = @"
            UPDATE auth.Users SET
                Password  = @Password,
                UpdatedAt = GETUTCDATE(),
                UpdatedBy = @UpdatedBy
            WHERE Id = @UserId";

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { UserId = userId, Password = password, UpdatedBy = updatedBy });
    }

    public async Task UpdateLastLoginAsync(int userId)
    {
        const string sql = "UPDATE auth.Users SET LastLoginAt = GETUTCDATE() WHERE Id = @UserId";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { UserId = userId });
    }
}
