using System.Text.Json;
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
    private const string CompanyCookieName = "monit_co";

    public async Task<LoginResponse> LoginAsync(LoginRequest dto, HttpResponse httpResponse)
    {
        var companyId = dto.CompanyId is 1 or 2 ? dto.CompanyId : 1;

        var user = await authRepo.GetByUsernameAsync(dto.Username, companyId)
            ?? throw new ValidationException("Invalid username or password.");

        if (!user.IsActive)
            throw new ForbiddenException("Account is disabled. Contact admin.");

        if (user.Password != dto.Password)
            throw new ValidationException("Invalid username or password.");

        user.CompanyId = companyId;

        var accessToken   = jwtService.GenerateAccessToken(user);
        var refreshToken  = jwtService.GenerateRefreshToken();
        var refreshExpiry = DateTime.UtcNow.AddDays(config.JwtRefreshExpiryDays);

        await authRepo.SaveRefreshTokenAsync(user.Id, refreshToken, refreshExpiry, companyId);
        await authRepo.UpdateLastLoginAsync(user.Id, companyId);

        SetRefreshCookie(httpResponse, refreshToken, refreshExpiry);
        SetCompanyCookie(httpResponse, companyId, refreshExpiry);

        List<string> permissions = [];
        if (!string.IsNullOrWhiteSpace(user.PermissionsJson))
        {
            try { permissions = JsonSerializer.Deserialize<List<string>>(user.PermissionsJson) ?? []; }
            catch { /* malformed JSON */ }
        }

        return new LoginResponse(
            AccessToken: accessToken,
            TokenType:   "Bearer",
            ExpiresAt:   jwtService.AccessTokenExpiry,
            User:        new UserInfo(user.Id, user.Username, user.Name, user.Role, user.CustomerName, companyId),
            Permissions: permissions
        );
    }

    public async Task<RefreshResponse> RefreshAsync(string refreshToken, HttpResponse httpResponse, int companyId)
    {
        var user = await authRepo.GetByRefreshTokenAsync(refreshToken, companyId)
            ?? throw new ValidationException("Invalid or expired session. Please log in again.");

        if (!user.IsActive)
            throw new ForbiddenException("Account is disabled.");

        user.CompanyId = companyId;

        var newAccessToken  = jwtService.GenerateAccessToken(user);
        var newRefreshToken = jwtService.GenerateRefreshToken();
        var newExpiry       = DateTime.UtcNow.AddDays(config.JwtRefreshExpiryDays);

        await authRepo.SaveRefreshTokenAsync(user.Id, newRefreshToken, newExpiry, companyId);
        SetRefreshCookie(httpResponse, newRefreshToken, newExpiry);
        SetCompanyCookie(httpResponse, companyId, newExpiry);

        return new RefreshResponse(
            AccessToken: newAccessToken,
            TokenType:   "Bearer",
            ExpiresAt:   jwtService.AccessTokenExpiry
        );
    }

    public async Task LogoutAsync(int userId, HttpResponse httpResponse, int companyId)
    {
        await authRepo.RevokeRefreshTokenAsync(userId, companyId);
        DeleteRefreshCookie(httpResponse);
        DeleteCompanyCookie(httpResponse);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest dto, int companyId)
    {
        var user = await authRepo.GetByIdAsync(userId, companyId)
            ?? throw new NotFoundException("User not found.");

        if (user.Password != dto.CurrentPassword)
            throw new ValidationException("Current password is incorrect.");

        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            throw new ValidationException("New password cannot be empty.");

        await authRepo.UpdatePasswordAsync(userId, dto.NewPassword, user.Username, companyId);
    }

    // ── Cookie helpers ────────────────────────────────────────────────────────

    private void SetRefreshCookie(HttpResponse response, string token, DateTime expiry)
    {
        response.Cookies.Append(RefreshCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure   = !env.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Expires  = expiry,
            Path     = "/api/v1/auth"
        });
    }

    private void SetCompanyCookie(HttpResponse response, int companyId, DateTime expiry)
    {
        response.Cookies.Append(CompanyCookieName, companyId.ToString(), new CookieOptions
        {
            HttpOnly = true,
            Secure   = !env.IsDevelopment(),
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

    private void DeleteCompanyCookie(HttpResponse response)
    {
        response.Cookies.Delete(CompanyCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure   = !env.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Path     = "/api/v1/auth"
        });
    }
}
