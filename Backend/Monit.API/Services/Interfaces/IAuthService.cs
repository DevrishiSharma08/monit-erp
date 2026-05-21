using Monit.API.Models.DTOs.Auth;

namespace Monit.API.Services.Interfaces;

public interface IAuthService
{
    Task<LoginResponse>  LoginAsync(LoginRequest dto, HttpResponse httpResponse);
    Task<RefreshResponse> RefreshAsync(string refreshToken, HttpResponse httpResponse, int companyId);
    Task LogoutAsync(int userId, HttpResponse httpResponse, int companyId);
    Task ChangePasswordAsync(int userId, ChangePasswordRequest dto, int companyId);
}
