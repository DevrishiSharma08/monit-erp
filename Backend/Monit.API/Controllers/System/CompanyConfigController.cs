using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Config;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Config;

[ApiController]
[Route("api/v1/company-config")]
[Authorize]
public class CompanyConfigController(ICompanyConfigService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    [HttpGet]
    public async Task<IActionResult> Get()
        => Ok(ApiResponse<CompanyConfigDto>.Ok(await svc.GetAsync()));

    [HttpPut]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update([FromBody] UpdateCompanyConfigDto dto)
        => Ok(ApiResponse<CompanyConfigDto>.Ok(
            await svc.UpdateAsync(dto, CurrentUser),
            "Company configuration saved successfully."));
}
