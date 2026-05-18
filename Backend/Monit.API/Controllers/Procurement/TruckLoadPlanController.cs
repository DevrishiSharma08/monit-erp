using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Procurement;

[ApiController]
[Route("api/v1/truck-load-plans")]
[Authorize]
public class TruckLoadPlanController(ITruckLoadPlanService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    /// <summary>GET /api/v1/truck-load-plans — paginated list with optional filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] TruckLoadPlanFilterRequest filter)
        => Ok(ApiResponse<PagedResult<TruckLoadPlanDto>>.Ok(await svc.GetAllAsync(filter)));

    /// <summary>GET /api/v1/truck-load-plans/{id} — single plan with all items</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<TruckLoadPlanDto>.Ok(await svc.GetByIdAsync(id)));

    /// <summary>
    /// POST /api/v1/truck-load-plans — create a new truck load plan.
    /// Items must reference mill tracker IDs (TrackerId) that are Partial Ready or Ready.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTruckLoadPlanDto dto)
    {
        var plan = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = plan.Id },
            ApiResponse<TruckLoadPlanDto>.Ok(plan, $"Load plan {plan.PlanNumber} created successfully."));
    }

    /// <summary>
    /// PATCH /api/v1/truck-load-plans/{id}/status — advance plan status.
    /// Moving to "In Transit" automatically updates DispatchedQty on all linked mill trackers.
    /// </summary>
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateTruckLoadPlanStatusDto dto)
    {
        var plan = await svc.UpdateStatusAsync(id, dto, CurrentUser);
        return Ok(ApiResponse<TruckLoadPlanDto>.Ok(plan, $"Plan status updated to '{dto.Status}'."));
    }

    /// <summary>DELETE /api/v1/truck-load-plans/{id} — soft delete (Admin/Manager only)</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Truck load plan deleted successfully."));
    }
}
