using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Auth;

[ApiController]
[Route("api/v1/users")]
[Authorize(Roles = "Admin")]
public class UsersController(IUserManagementService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    // GET api/v1/users?search=&roleId=&role=&isActive=&sortBy=&page=&pageSize=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] UserFilterRequest filter)
        => Ok(ApiResponse<PagedResult<UserListDto>>.Ok(await svc.GetAllAsync(filter)));

    // GET api/v1/users/dropdown
    [HttpGet("dropdown")]
    [Authorize]   // any logged-in user (for FK selects)
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<UserDropdownDto>>.Ok(await svc.GetDropdownAsync()));

    // GET api/v1/users/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<UserDetailDto>.Ok(await svc.GetByIdAsync(id)));

    // POST api/v1/users
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<UserDetailDto>.Ok(result, "User created successfully."));
    }

    // PUT api/v1/users/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserDto dto)
        => Ok(ApiResponse<UserDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "User updated successfully."));

    // POST api/v1/users/{id}/reset-password
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto dto)
    {
        await svc.ResetPasswordAsync(id, dto, CurrentUser);
        return Ok(ApiResponse.Ok("Password reset successfully."));
    }

    // DELETE api/v1/users/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("User deleted successfully."));
    }

    // GET api/v1/users/export?format=excel|pdf|word
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] UserFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"Users_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
