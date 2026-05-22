using Monit.API.Models.Entities.Auth;

namespace Monit.API.Repositories.Interfaces;

public interface IAuthRepository
{
    Task<User?> GetByUsernameAsync(string username, int companyId);
    Task<User?> GetByIdAsync(int id, int companyId);
    Task<User?> GetByRefreshTokenAsync(string refreshToken, int companyId);
    Task SaveRefreshTokenAsync(int userId, string token, DateTime expiry, int companyId);
    Task RevokeRefreshTokenAsync(int userId, int companyId);
    Task UpdatePasswordAsync(int userId, string password, string updatedBy, int companyId);
    Task UpdateLastLoginAsync(int userId, int companyId);
}
