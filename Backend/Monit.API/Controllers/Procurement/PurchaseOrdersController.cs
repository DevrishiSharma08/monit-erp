using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Procurement;

[ApiController]
[Route("api/v1/purchase-orders")]
[Authorize]
public class PurchaseOrdersController(IPurchaseOrderService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PurchaseOrderFilterRequest filter)
        => Ok(ApiResponse<PagedResult<PurchaseOrderListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<PurchaseOrderListDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseOrderDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<PurchaseOrderListDto>.Ok(result, "Purchase order created successfully."));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePurchaseOrderDto dto)
        => Ok(ApiResponse<PurchaseOrderListDto>.Ok(
            await svc.UpdateAsync(id, dto, CurrentUser), "Purchase order updated successfully."));

    [HttpPatch("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        await svc.ApproveAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Purchase order approved — status set to Sent to Mill."));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Purchase order deleted successfully."));
    }
}
