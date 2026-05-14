using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/stock-categories")]
[Authorize]
public class StockCategoriesController(IStockCategoryService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] StockCategoryFilterRequest filter)
        => Ok(ApiResponse<PagedResult<StockCategoryListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown([FromQuery] int? stockGroupId = null)
        => Ok(ApiResponse<List<StockCategoryDropdownDto>>.Ok(await svc.GetDropdownAsync(stockGroupId)));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<StockCategoryDetailDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateStockCategoryDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<StockCategoryDetailDto>.Ok(result, "Stock Category created successfully."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStockCategoryDto dto)
        => Ok(ApiResponse<StockCategoryDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Stock Category updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Stock Category deleted successfully."));
    }

    [HttpPost("bulk")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> BulkCreate([FromBody] BulkCreateGsmDto dto)
    {
        var result = await svc.BulkCreateAsync(dto, CurrentUser);
        return Ok(ApiResponse<List<StockCategoryDetailDto>>.Ok(result, $"{result.Count} GSM value(s) created successfully."));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] StockCategoryFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"StockCategories_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
