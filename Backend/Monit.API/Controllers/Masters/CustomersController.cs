using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/customers")]
[Authorize]
public class CustomersController(ICustomerService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] CustomerFilterRequest filter)
        => Ok(ApiResponse<PagedResult<CustomerListDto>>.Ok(await svc.GetAllAsync(filter)));

    [HttpGet("dropdown")]
    public async Task<IActionResult> Dropdown()
        => Ok(ApiResponse<List<CustomerDropdownDto>>.Ok(await svc.GetDropdownAsync()));

    [HttpGet("for-so")]
    public async Task<IActionResult> ForSO()
        => Ok(ApiResponse<List<CustomerSODropdownDto>>.Ok(await svc.GetForSOAsync()));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<CustomerDetailDto>.Ok(await svc.GetByIdAsync(id)));

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateCustomerDto dto)
    {
        var result = await svc.CreateAsync(dto, CurrentUser);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<CustomerDetailDto>.Ok(result, "Customer created successfully."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomerDto dto)
        => Ok(ApiResponse<CustomerDetailDto>.Ok(await svc.UpdateAsync(id, dto, CurrentUser), "Customer updated successfully."));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Customer deleted successfully."));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] CustomerFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"Customers_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
