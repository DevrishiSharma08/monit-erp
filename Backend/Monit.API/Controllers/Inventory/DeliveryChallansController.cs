using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Inventory;

[ApiController]
[Route("api/v1/delivery-challans")]
[Authorize]
public class DeliveryChallansController(IDeliveryChallanService svc) : ControllerBase
{
    private string CurrentUser =>
        User.FindFirst("name")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
        ?? "system";

    // GET /api/v1/delivery-challans
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] DeliveryChallanFilterRequest filter)
        => Ok(ApiResponse<PagedResult<DeliveryChallanDto>>.Ok(await svc.GetAllAsync(filter)));

    // GET /api/v1/delivery-challans/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<DeliveryChallanDto>.Ok(await svc.GetByIdAsync(id)));

    // GET /api/v1/delivery-challans/{id}/pdf — Delivery Note print/download.
    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> DownloadPdf(int id)
    {
        var dc       = await svc.GetByIdAsync(id);
        var pdfBytes = await svc.GetPdfAsync(id);
        var fileName = $"DC_{dc.ChallanNumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    // Same document as /pdf, rendered as one stitched JPG — matches the SO/PO
    // "Export as Image" pattern so a challan can be shared without a PDF viewer.
    [HttpGet("{id:int}/image")]
    public async Task<IActionResult> DownloadImage(int id)
    {
        var dc         = await svc.GetByIdAsync(id);
        var imageBytes = await svc.GetImageAsync(id);
        var fileName   = $"DC_{dc.ChallanNumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.jpg";
        return File(imageBytes, "image/jpeg", fileName);
    }

    // GET /api/v1/delivery-challans/open-sos?customerId=...
    // Lists SOs that still have undelivered qty â€” drives the Create DC picker.
    [HttpGet("open-sos")]
    public async Task<IActionResult> GetOpenSos([FromQuery] int? customerId)
        => Ok(ApiResponse<List<OpenSoForDcDto>>.Ok(await svc.GetOpenSosAsync(customerId)));

    // GET /api/v1/delivery-challans/sources/{soLineId}
    // Returns stock lots + direct-from-mill GRN portions matching the SO line.
    [HttpGet("sources/{soLineId:int}")]
    public async Task<IActionResult> GetSources(int soLineId)
        => Ok(ApiResponse<List<AvailableStockSourceDto>>.Ok(await svc.GetAvailableSourcesForSoLineAsync(soLineId)));

    // POST /api/v1/delivery-challans
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDeliveryChallanDto dto)
    {
        var dc = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = dc.Id },
            ApiResponse<DeliveryChallanDto>.Ok(dc, $"Delivery challan {dc.ChallanNumber} created successfully."));
    }

    // PATCH /api/v1/delivery-challans/{id}/status
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateDeliveryChallanStatusDto dto)
        => Ok(ApiResponse<DeliveryChallanDto>.Ok(
            await svc.UpdateStatusAsync(id, dto, CurrentUser),
            $"Challan status updated to '{dto.Status}'."));

    // DELETE /api/v1/delivery-challans/{id}
    [HttpDelete("{id:int}")]
    [RequirePerm("grn.delete")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Delivery challan deleted successfully."));
    }
}
