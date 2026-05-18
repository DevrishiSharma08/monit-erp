using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/mills")]
[Authorize]
public class MillsController(IMillService millService) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    // ─── GET api/v1/masters/mills
    // Query: search, state, paymentTerms, freightType, isActive,
    //        sortBy, sortOrder, page, pageSize
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] MillFilterRequest filter)
    {
        var result = await millService.GetAllAsync(filter);
        return Ok(ApiResponse<PagedResult<MillListDto>>.Ok(result));
    }

    // ─── GET api/v1/masters/mills/dropdown
    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<MillDropdownDto>>.Ok(await millService.GetDropdownAsync()));

    // ─── GET api/v1/masters/mills/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await millService.GetByIdAsync(id);
        return Ok(ApiResponse<MillDetailDto>.Ok(result));
    }

    // ─── POST api/v1/masters/mills
    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateMillDto dto)
    {
        var result = await millService.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<MillDetailDto>.Ok(result, "Mill created successfully."));
    }

    // ─── PUT api/v1/masters/mills/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMillDto dto)
    {
        var result = await millService.UpdateAsync(id, dto, CurrentUser);
        return Ok(ApiResponse<MillDetailDto>.Ok(result, "Mill updated successfully."));
    }

    // ─── DELETE api/v1/masters/mills/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await millService.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Mill deleted successfully."));
    }

    // ─── GET api/v1/masters/mills/export?format=excel|pdf|word
    // All active filters are applied — exports full filtered result (no pagination).
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] MillFilterRequest filter,
                                            [FromQuery] string format = "excel")
    {
        var bytes = await millService.ExportAsync(filter, format);

        var (contentType, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };

        var fileName = $"Mills_{DateTime.Now:yyyyMMdd_HHmm}.{ext}";
        return File(bytes, contentType, fileName);
    }
}
