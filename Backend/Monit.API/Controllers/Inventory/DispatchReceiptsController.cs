using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Inventory;

[ApiController]
[Route("api/v1/dispatch-receipts")]
[Authorize]
public class DispatchReceiptsController(IDispatchReceiptService svc) : ControllerBase
{
    private string CurrentUser =>
        User.FindFirst("name")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
        ?? "system";

    // GET /api/v1/dispatch-receipts
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] DispatchReceiptFilterRequest filter)
    {
        var result = await svc.GetAllAsync(filter);
        return Ok(ApiResponse<PagedResult<DispatchReceiptDto>>.Ok(result));
    }

    // GET /api/v1/dispatch-receipts/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var dr = await svc.GetByIdAsync(id);
        return Ok(ApiResponse<DispatchReceiptDto>.Ok(dr));
    }

    // GET /api/v1/dispatch-receipts/pending-tlps
    // TLPs that have left the mill but don't yet have a dispatch entry â€”
    // dispatch user picks one from this list to start a new DispatchReceipt.
    [HttpGet("pending-tlps")]
    public async Task<IActionResult> GetPendingTlps()
    {
        var result = await svc.GetPendingTlpsAsync();
        return Ok(ApiResponse<List<PendingTlpForDispatchDto>>.Ok(result));
    }

    // POST /api/v1/dispatch-receipts
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDispatchReceiptDto dto)
    {
        var dr = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = dr.Id },
            ApiResponse<DispatchReceiptDto>.Ok(dr, "Dispatch receipt created successfully."));
    }

    // PUT /api/v1/dispatch-receipts/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDispatchReceiptDto dto)
        => Ok(ApiResponse<DispatchReceiptDto>.Ok(
            await svc.UpdateAsync(id, dto, CurrentUser),
            "Dispatch receipt updated successfully."));

    // DELETE /api/v1/dispatch-receipts/{id}
    [HttpDelete("{id:int}")]
    [RequirePerm("grn.delete")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Dispatch receipt deleted successfully."));
    }
}
