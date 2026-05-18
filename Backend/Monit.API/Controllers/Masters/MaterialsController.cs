using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/materials")]
[Authorize]
public class MaterialsController(IMaterialService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    // GET api/v1/masters/materials?millId=&categoryId=&gsm=&sizeId=&packingType=&isActive=&search=&sortBy=&page=&pageSize=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] MaterialFilterRequest filter)
        => Ok(ApiResponse<PagedResult<MaterialListDto>>.Ok(await svc.GetAllAsync(filter)));

    // GET api/v1/masters/materials/dropdown?millId=&categoryId=
    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown([FromQuery] int? millId = null, [FromQuery] int? categoryId = null)
        => Ok(ApiResponse<List<MaterialDropdownDto>>.Ok(await svc.GetDropdownAsync(millId, categoryId)));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<MaterialDetailDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateMaterialDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<MaterialDetailDto>.Ok(result, "Material created successfully."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMaterialDto dto)
        => Ok(ApiResponse<MaterialDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Material updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Material deleted successfully."));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] MaterialFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"Materials_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
