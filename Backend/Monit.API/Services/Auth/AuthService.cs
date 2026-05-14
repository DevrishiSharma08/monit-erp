using Microsoft.AspNetCore.Hosting;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Auth;

public class AuthService(
    IAuthRepository  authRepo,
    IJwtService      jwtService,
    AppConfig        config,
    IWebHostEnvironment env) : IAuthService
{
    private const string RefreshCookieName = "monit_rt";

    public async Task<LoginResponse> LoginAsync(LoginRequest dto, HttpResponse httpResponse)
    {
        var user = await authRepo.GetByUsernameAsync(dto.Username)
            ?? throw new ValidationException("Invalid username or password.");

        if (!user.IsActive)
            throw new ForbiddenException("Account is disabled. Contact admin.");

        if (user.Password != dto.Password)
            throw new ValidationException("Invalid username or password.");

        var accessToken   = jwtService.GenerateAccessToken(user);
        var refreshToken  = jwtService.GenerateRefreshToken();
        var refreshExpiry = DateTime.UtcNow.AddDays(config.JwtRefreshExpiryDays);

        await authRepo.SaveRefreshTokenAsync(user.Id, refreshToken, refreshExpiry);
        await authRepo.UpdateLastLoginAsync(user.Id);

        SetRefreshCookie(httpResponse, refreshToken, refreshExpiry);

        return new LoginResponse(
            AccessToken: accessToken,
            TokenType:   "Bearer",
            ExpiresAt:   jwtService.AccessTokenExpiry,
            User: new UserInfo(user.Id, user.Username, user.Name, user.Role, user.CustomerName)
        );
    }

    public async Task<RefreshResponse> RefreshAsync(string refreshToken, HttpResponse httpResponse)
    {
        var user = await authRepo.GetByRefreshTokenAsync(refreshToken)
            ?? throw new ValidationException("Invalid or expired session. Please log in again.");

        if (!user.IsActive)
            throw new ForbiddenException("Account is disabled.");

        var newAccessToken  = jwtService.GenerateAccessToken(user);
        var newRefreshToken = jwtService.GenerateRefreshToken();
        var newExpiry       = DateTime.UtcNow.AddDays(config.JwtRefreshExpiryDays);

        await authRepo.SaveRefreshTokenAsync(user.Id, newRefreshToken, newExpiry);
        SetRefreshCookie(httpResponse, newRefreshToken, newExpiry);

        return new RefreshResponse(
            AccessToken: newAccessToken,
            TokenType:   "Bearer",
            ExpiresAt:   jwtService.AccessTokenExpiry
        );
    }

    public async Task LogoutAsync(int userId, HttpResponse httpResponse)
    {
        await authRepo.RevokeRefreshTokenAsync(userId);
        DeleteRefreshCookie(httpResponse);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest dto)
    {
        var user = await authRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException("User not found.");

        if (user.Password != dto.CurrentPassword)
            throw new ValidationException("Current password is incorrect.");

        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            throw new ValidationException("New password cannot be empty.");

        await authRepo.UpdatePasswordAsync(userId, dto.NewPassword, user.Username);
    }

    private void SetRefreshCookie(HttpResponse response, string token, DateTime expiry)
    {
        response.Cookies.Append(RefreshCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure   = !env.IsDevelopment(),   // HTTP-safe in dev; HTTPS-only in prod
            SameSite = SameSiteMode.Strict,
            Expires  = expiry,
            Path     = "/api/v1/auth"
        });
    }

    private void DeleteRefreshCookie(HttpResponse response)
    {
        response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure   = !env.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Path     = "/api/v1/auth"
        });
    }
}
