using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Helpers;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
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
    {
        var result = await svc.GetAllAsync(filter);
        if (RoleGuard.ShouldHideCost(User))
            foreach (var po in result.Items)
                po.TotalValue = 0;
        return Ok(ApiResponse<PagedResult<PurchaseOrderListDto>>.Ok(result));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await svc.GetByIdAsync(id);
        if (RoleGuard.ShouldHideCost(User)) result.TotalValue = 0;
        return Ok(ApiResponse<PurchaseOrderListDto>.Ok(result));
    }

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

    [HttpPost("{id:int}/send-email")]
    public async Task<IActionResult> SendEmail(int id, [FromBody] SendMailRequestDto dto)
        => Ok(ApiResponse<SendMailResponseDto>.Ok(
            await svc.SendEmailAsync(id, dto), "Email sent successfully."));

    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> DownloadPdf(int id)
    {
        var po       = await svc.GetByIdAsync(id);
        var pdfBytes = await svc.GetPdfAsync(id);
        var fileName = $"PO_{po.PONumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }
}
