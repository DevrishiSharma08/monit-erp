using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Procurement;

[ApiController]
[Route("api/v1/mill-tracker")]
[Authorize]
public class MillTrackerController(IMillTrackerService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    /// <summary>GET /api/v1/mill-tracker — paginated list with optional filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] MillTrackerFilterRequest filter)
        => Ok(ApiResponse<PagedResult<MillTrackerListDto>>.Ok(await svc.GetAllAsync(filter)));

    /// <summary>GET /api/v1/mill-tracker/{id} — single tracker with batches + history</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<MillTrackerListDto>.Ok(await svc.GetByIdAsync(id)));

    /// <summary>GET /api/v1/mill-tracker/by-po/{poId} — all trackers for a purchase order</summary>
    [HttpGet("by-po/{poId:int}")]
    public async Task<IActionResult> GetByPo(int poId)
        => Ok(ApiResponse<List<MillTrackerListDto>>.Ok(await svc.GetByPoIdAsync(poId)));

    /// <summary>PATCH /api/v1/mill-tracker/{id}/status — update production status + optional ready qty</summary>
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateMillTrackerStatusDto dto)
        => Ok(ApiResponse<MillTrackerListDto>.Ok(
            await svc.UpdateStatusAsync(id, dto, CurrentUser),
            "Status updated successfully."));

    /// <summary>POST /api/v1/mill-tracker/{id}/batches — record a dispatch batch</summary>
    [HttpPost("{id:int}/batches")]
    public async Task<IActionResult> AddBatch(int id, [FromBody] AddMillTrackerBatchDto dto)
        => Ok(ApiResponse<MillTrackerBatchDto>.Ok(
            await svc.AddBatchAsync(id, dto, CurrentUser),
            "Dispatch batch recorded successfully."));

    /// <summary>GET /api/v1/mill-tracker/template — download CSV template for bulk import</summary>
    [HttpGet("template")]
    public IActionResult DownloadTemplate()
    {
        var csv = new StringBuilder();
        csv.AppendLine("PO Number,Ready Qty,Status,Expected Date,Remarks");
        csv.AppendLine("\"PO-2024-001\",\"9000\",\"In Production\",\"2024-02-15\",\"Mill team update\"");
        csv.AppendLine("\"PO-2024-002\",\"20000\",\"Ready\",\"\",\"Full batch ready\"");
        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        return File(bytes, "text/csv", "mill_tracker_template.csv");
    }

    /// <summary>POST /api/v1/mill-tracker/bulk-import — update multiple trackers from parsed CSV rows</summary>
    [HttpPost("bulk-import")]
    public async Task<IActionResult> BulkImport([FromBody] List<BulkImportRowDto> rows)
        => Ok(ApiResponse<BulkImportResultDto>.Ok(
            await svc.BulkImportAsync(rows, CurrentUser),
            "Bulk import completed."));

    /// <summary>DELETE /api/v1/mill-tracker/{id} — soft delete (Admin/Manager only)</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Mill tracker deleted successfully."));
    }
}
