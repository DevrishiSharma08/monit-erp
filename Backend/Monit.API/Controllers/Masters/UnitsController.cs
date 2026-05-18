using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/units")]
[Authorize]
public class UnitsController(IUnitService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] UnitFilterRequest filter)
        => Ok(ApiResponse<PagedResult<UnitListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<UnitDropdownDto>>.Ok(await svc.GetDropdownAsync()));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<UnitDetailDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateUnitDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<UnitDetailDto>.Ok(result, "Unit created successfully."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUnitDto dto)
        => Ok(ApiResponse<UnitDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Unit updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Unit deleted successfully."));
    }
}
