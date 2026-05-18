using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Sales;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Sales;

[ApiController]
[Route("api/v1/sales-orders")]
[Authorize]
public class SalesOrdersController(ISalesOrderService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] SalesOrderFilterRequest filter)
        => Ok(ApiResponse<PagedResult<SalesOrderListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<SalesOrderListDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSalesOrderDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<SalesOrderListDto>.Ok(result, "Sales order created successfully."));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSalesOrderDto dto)
        => Ok(ApiResponse<SalesOrderListDto>.Ok(
            await svc.UpdateAsync(id, dto, CurrentUser), "Sales order updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Sales order deleted successfully."));
    }
}
