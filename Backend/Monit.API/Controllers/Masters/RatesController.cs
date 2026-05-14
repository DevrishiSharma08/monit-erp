using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Masters;

[ApiController]
[Route("api/v1/masters/rates")]
[Authorize]
public class RatesController(IRateService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    // GET api/v1/masters/rates?rateType=Sale&mqgId=&customerId=&rateCategory=&isActive=&search=&page=&pageSize=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] RateFilterRequest filter)
        => Ok(ApiResponse<PagedResult<RateListDto>>.Ok(await svc.GetCurrentRatesAsync(filter)));

    // GET api/v1/masters/rates/for-customer/{customerId}  — used by SO form for rate auto-fill
    [HttpGet("for-customer/{customerId:int}")]
    public async Task<IActionResult> ForCustomer(int customerId)
        => Ok(ApiResponse<List<SORateDto>>.Ok(await svc.GetForCustomerAsync(customerId)));

    // GET api/v1/masters/rates/{id}/history
    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> History(int id)
        => Ok(ApiResponse<List<RateHistoryDto>>.Ok(await svc.GetHistoryAsync(id)));

    [HttpPost("sale")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> CreateSale([FromBody] CreateSaleRateDto dto)
    {
        var result = await svc.CreateSaleRatesAsync(dto, CurrentUser);
        return StatusCode(201, ApiResponse<List<RateListDto>>.Ok(result, "Sale rate(s) created successfully."));
    }

    [HttpPost("purchase")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> CreatePurchase([FromBody] CreatePurchaseRateDto dto)
    {
        var result = await svc.CreatePurchaseRatesAsync(dto, CurrentUser);
        return StatusCode(201, ApiResponse<List<RateListDto>>.Ok(result, "Purchase rate(s) created successfully."));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Rate deleted successfully."));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] RateFilterRequest filter, [FromQuery] string format = "excel")
    {
        var bytes = await svc.ExportAsync(filter, format);
        var (ct, ext) = format.ToLower() switch
        {
            "pdf"  => ("application/pdf", "pdf"),
            "word" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            _      => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
        };
        return File(bytes, ct, $"Rates_{DateTime.Now:yyyyMMdd_HHmm}.{ext}");
    }
}
