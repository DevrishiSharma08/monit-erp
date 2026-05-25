using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Helpers;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
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
    {
        var result = await svc.GetAllAsync(filter);
        bool hideCost  = RoleGuard.ShouldHideCost(User);
        bool hidePhone = RoleGuard.ShouldHidePhone(User);
        if (hideCost || hidePhone)
            foreach (var so in result.Items)
                MaskSensitiveFields(so, hideCost, hidePhone);
        return Ok(ApiResponse<PagedResult<SalesOrderListDto>>.Ok(result));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await svc.GetByIdAsync(id);
        if (RoleGuard.ShouldHideCost(User) || RoleGuard.ShouldHidePhone(User))
            MaskSensitiveFields(result, RoleGuard.ShouldHideCost(User), RoleGuard.ShouldHidePhone(User));
        return Ok(ApiResponse<SalesOrderListDto>.Ok(result));
    }

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

    [HttpPatch("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        await svc.ApproveAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Sales order approved — status set to Pending Allocation."));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Sales order deleted successfully."));
    }

    // GET api/v1/sales-orders/{id}/purchase-orders
    [HttpGet("{id:int}/purchase-orders")]
    public async Task<IActionResult> GetLinkedPOs(int id)
        => Ok(ApiResponse<List<SoLinkedPoDto>>.Ok(await svc.GetLinkedPOsAsync(id)));

    [HttpPost("{id:int}/send-email")]
    public async Task<IActionResult> SendEmail(int id, [FromBody] SendMailRequestDto dto)
        => Ok(ApiResponse<SendMailResponseDto>.Ok(
            await svc.SendEmailAsync(id, dto), "Email sent successfully."));

    private static void MaskSensitiveFields(SalesOrderListDto so, bool hideCost, bool hidePhone)
    {
        if (hideCost)
        {
            so.TotalValue = 0;
            foreach (var line in so.Lines)
            {
                line.Rate       = 0;
                line.Discount   = 0;
                line.FinalPrice = 0;
                line.Amount     = 0;
            }
        }
        if (hidePhone) so.CustomerPhone = null;
    }
}
