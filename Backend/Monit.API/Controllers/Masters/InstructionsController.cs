using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/instructions")]
[Authorize]
public class InstructionsController(IInstructionService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] InstructionFilterRequest filter)
        => Ok(ApiResponse<PagedResult<InstructionListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<InstructionDropdownDto>>.Ok(await svc.GetDropdownAsync()));

    /// <summary>Returns all active instructions applicable to the given mill (All scope + specific scope for that mill).</summary>
    [HttpGet("by-mill")]
    public async Task<IActionResult> ByMill([FromQuery] int? millId)
        => Ok(ApiResponse<List<InstructionDropdownDto>>.Ok(await svc.GetByMillAsync(millId)));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<InstructionDetailDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateInstructionDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<InstructionDetailDto>.Ok(result, "Instruction set created successfully."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInstructionDto dto)
        => Ok(ApiResponse<InstructionDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Instruction set updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Instruction set deleted successfully."));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] InstructionFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"Instructions_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
