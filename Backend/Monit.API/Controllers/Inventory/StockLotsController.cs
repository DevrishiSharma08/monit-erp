using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Helpers;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Inventory;

[ApiController]
[Route("api/v1/stock-lots")]
[Authorize]
public class StockLotsController(IStockLotService svc) : ControllerBase
{
    private string CurrentUser =>
        User.FindFirst("name")?.Value ??
        User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ??
        "system";

    // GET api/v1/stock-lots
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] StockLotFilterRequest filter)
    {
        var result = await svc.GetAllAsync(filter);
        if (RoleGuard.ShouldHideCost(User))
            foreach (var lot in result.Items)
            {
                lot.CostPerUnit = null;
                lot.TotalCost   = null;
            }
        return Ok(ApiResponse<PagedResult<StockLotRow>>.Ok(result));
    }

    // GET api/v1/stock-lots/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var lot = await svc.GetByIdAsync(id);
            if (RoleGuard.ShouldHideCost(User))
            {
                lot.CostPerUnit = null;
                lot.TotalCost   = null;
                lot.PoRate      = null;
            }
            return Ok(ApiResponse<StockLotDetailRow>.Ok(lot));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // PATCH api/v1/stock-lots/{id}
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStockLotDto dto)
    {
        try
        {
            var lot = await svc.UpdateAsync(id, dto, CurrentUser);
            return Ok(ApiResponse<StockLotDetailRow>.Ok(lot, "Stock lot updated."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // DELETE api/v1/stock-lots/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            await svc.DeleteAsync(id, CurrentUser);
            return Ok(ApiResponse<string>.Ok("deleted", "Stock lot deleted."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }
}
