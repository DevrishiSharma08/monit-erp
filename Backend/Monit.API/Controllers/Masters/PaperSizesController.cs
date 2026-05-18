using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/paper-sizes")]
[Authorize]
public class PaperSizesController(IPaperSizeService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PaperSizeFilterRequest filter)
        => Ok(ApiResponse<PagedResult<PaperSizeListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<PaperSizeDropdownDto>>.Ok(await svc.GetDropdownAsync()));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<PaperSizeDetailDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreatePaperSizeDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<PaperSizeDetailDto>.Ok(result, "Paper Size created successfully."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePaperSizeDto dto)
        => Ok(ApiResponse<PaperSizeDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Paper Size updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Paper Size deleted successfully."));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] PaperSizeFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"PaperSizes_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
