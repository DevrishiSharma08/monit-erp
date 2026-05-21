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
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["monit_rt"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(ApiResponse<object>.Fail("No refresh token. Please log in again."));

        var companyId = GetCompanyIdFromCookie();
        var result = await authService.RefreshAsync(refreshToken, Response, companyId);
        return Ok(ApiResponse<RefreshResponse>.Ok(result));
    }

    // POST api/v1/auth/logout
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userId    = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        var companyId = GetCompanyIdFromClaim();
        await authService.LogoutAsync(userId, Response, companyId);
        return Ok(ApiResponse.Ok("Logged out successfully."));
    }

    // POST api/v1/auth/change-password
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest dto)
    {
        var userId    = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        var companyId = GetCompanyIdFromClaim();
        await authService.ChangePasswordAsync(userId, dto, companyId);
        return Ok(ApiResponse.Ok("Password changed successfully."));
    }

    // GET api/v1/auth/me
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var companyId = GetCompanyIdFromClaim();
        var info = new UserInfo(
            int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value),
            User.FindFirst(System.Security.Claims.ClaimTypes.Name)!.Value,
            User.FindFirst("name")!.Value,
            User.FindFirst(System.Security.Claims.ClaimTypes.Role)!.Value,
            null,
            companyId
        );
        return Ok(ApiResponse<UserInfo>.Ok(info));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int GetCompanyIdFromClaim()
    {
        var claim = User.FindFirst("company_id")?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }

    private int GetCompanyIdFromCookie()
    {
        var cookie = Request.Cookies["monit_co"];
        return int.TryParse(cookie, out var id) ? id : 1;
    }
}
