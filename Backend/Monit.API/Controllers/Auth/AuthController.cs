using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Auth;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    // POST api/v1/auth/login
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest dto)
    {
        var result = await authService.LoginAsync(dto, Response);
        return Ok(ApiResponse<LoginResponse>.Ok(result, "Login successful."));
    }

    // POST api/v1/auth/refresh
    // Refresh token comes automatically from HttpOnly cookie — no body needed.
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["monit_rt"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(ApiResponse<object>.Fail("No refresh token. Please log in again."));

        var result = await authService.RefreshAsync(refreshToken, Response);
        return Ok(ApiResponse<RefreshResponse>.Ok(result));
    }

    // POST api/v1/auth/logout
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("Invalid token claims."));
        await authService.LogoutAsync(userId, Response);
        return Ok(ApiResponse.Ok("Logged out successfully."));
    }

    // POST api/v1/auth/change-password
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest dto)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("Invalid token claims."));
        await authService.ChangePasswordAsync(userId, dto);
        return Ok(ApiResponse.Ok("Password changed successfully."));
    }

    // GET api/v1/auth/me — get current user info from token
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        if (!TryGetUserId(out var userId)) return Unauthorized(ApiResponse<object>.Fail("Invalid token claims."));
        var username    = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "";
        var displayName = User.FindFirst("name")?.Value ?? "";
        var role        = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
        var customer    = User.FindFirst("customerName")?.Value;
        return Ok(ApiResponse<UserInfo>.Ok(new UserInfo(userId, username, displayName, role, customer)));
    }

    private bool TryGetUserId(out int userId)
    {
        userId = 0;
        var raw = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return raw != null && int.TryParse(raw, out userId);
    }
}
