using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Auth;

[ApiController]
[Route("api/v1/roles")]
[Authorize(Roles = "Admin")]
public class RolesController(IRoleService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    // GET api/v1/roles
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] RoleFilterRequest filter)
        => Ok(ApiResponse<PagedResult<RoleListDto>>.Ok(await svc.GetAllAsync(filter)));

    // GET api/v1/roles/dropdown
    [HttpGet("dropdown")]
    [Authorize]
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<RoleDropdownDto>>.Ok(await svc.GetDropdownAsync()));

    // GET api/v1/roles/permissions  — returns all available permission strings grouped
    [HttpGet("permissions")]
    [Authorize]
    public async Task<IActionResult> Permissions()
        => Ok(ApiResponse<List<PermissionGroupDto>>.Ok(await svc.GetAvailablePermissionsAsync()));

    // GET api/v1/roles/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<RoleDetailDto>.Ok(await svc.GetByIdAsync(id)));

    // POST api/v1/roles
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRoleDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<RoleDetailDto>.Ok(result, "Role created successfully."));
    }

    // PUT api/v1/roles/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleDto dto)
        => Ok(ApiResponse<RoleDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Role updated successfully."));

    // DELETE api/v1/roles/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Role deleted successfully."));
    }
}
