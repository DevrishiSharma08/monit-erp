using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs;
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
    [RequirePerm("so.write")]
    public async Task<IActionResult> Create([FromBody] CreateSalesOrderDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<SalesOrderListDto>.Ok(result, "Sales order created successfully."));
    }

    [HttpPut("{id:int}")]
    [RequirePerm("so.write")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSalesOrderDto dto)
        => Ok(ApiResponse<SalesOrderListDto>.Ok(
            await svc.UpdateAsync(id, dto, CurrentUser), "Sales order updated successfully."));

    [HttpPatch("{id:int}/approve")]
    [RequirePerm("approvals.write")]
    public async Task<IActionResult> Approve(int id)
    {
        await svc.ApproveAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Sales order approved — status set to Pending Allocation."));
    }

    [HttpDelete("{id:int}")]
    [RequirePerm("so.delete")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Sales order deleted successfully."));
    }

    // Distinct from Delete — keeps the SO number/row visible (greyed out) for
    // tracking instead of removing it.
    [HttpPatch("{id:int}/cancel")]
    [RequirePerm("so.delete")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelSalesOrderDto dto)
        => Ok(ApiResponse<SalesOrderListDto>.Ok(
            await svc.CancelAsync(id, dto, CurrentUser), "Sales order cancelled."));

    [HttpPost("{id:int}/send-email")]
    public async Task<IActionResult> SendEmail(int id, [FromBody] SendMailRequestDto dto)
        => Ok(ApiResponse<SendMailResponseDto>.Ok(
            await svc.SendEmailAsync(id, dto), "Email sent successfully."));

    // Single-SO PDF — same layout as the Preview / Print view in the app.
    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> DownloadPdf(int id)
    {
        var so       = await svc.GetByIdAsync(id);
        var pdfBytes = await svc.GetPdfAsync(id);
        var fileName = $"SO_{so.SONumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    // Same document as /pdf, rendered as one stitched JPG — client-requested
    // so an SO can be shared as an image that opens instantly (no PDF viewer).
    [HttpGet("{id:int}/image")]
    public async Task<IActionResult> DownloadImage(int id)
    {
        var so         = await svc.GetByIdAsync(id);
        var imageBytes = await svc.GetImageAsync(id);
        var fileName   = $"SO_{so.SONumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.jpg";
        return File(imageBytes, "image/jpeg", fileName);
    }

    // Bulk-SO PDF — powers the grid's "Export → PDF" so the file contains
    // each selected SO laid out the same way as the single PDF (one SO per
    // page) rather than a generic table dump.
    [HttpPost("pdf-bulk")]
    public async Task<IActionResult> DownloadBulkPdf([FromBody] BulkIdsRequestDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0)
            return BadRequest(ApiResponse.Fail("No SO ids supplied for bulk PDF."));
        var pdfBytes = await svc.GetBulkPdfAsync(dto.Ids);
        var fileName = $"SalesOrders_{DateTime.Today:yyyyMMdd}_{dto.Ids.Length}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    // Separate-files flow — each SO becomes its own PDF inside a single ZIP.
    [HttpPost("pdf-bulk-zip")]
    public async Task<IActionResult> DownloadBulkPdfZip([FromBody] BulkIdsRequestDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0)
            return BadRequest(ApiResponse.Fail("No SO ids supplied for ZIP export."));
        var zipBytes = await svc.GetBulkPdfZipAsync(dto.Ids);
        var fileName = $"SalesOrders_{DateTime.Today:yyyyMMdd}_{dto.Ids.Length}.zip";
        return File(zipBytes, "application/zip", fileName);
    }

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
