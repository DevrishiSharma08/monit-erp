using Monit.API.Models.Entities.Auth;

namespace Monit.API.Repositories.Interfaces;

public interface IAuthRepository
{
    Task<User?> GetByUsernameAsync(string username);
    Task<User?> GetByIdAsync(int id);
    Task<User?> GetByRefreshTokenAsync(string refreshToken);
    Task SaveRefreshTokenAsync(int userId, string token, DateTime expiry);
    Task RevokeRefreshTokenAsync(int userId);
    Task UpdatePasswordAsync(int userId, string passwordHash, string updatedBy);
    Task UpdateLastLoginAsync(int userId);
}
