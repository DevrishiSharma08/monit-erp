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

    /// <summary>GET /api/v1/company-config — list all companies (Id 1 and 2)</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(ApiResponse<List<CompanyConfigDto>>.Ok(await svc.GetAllAsync()));

    /// <summary>GET /api/v1/company-config/{id} — single company config</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
        => Ok(ApiResponse<CompanyConfigDto>.Ok(await svc.GetAsync(id)));

    /// <summary>PUT /api/v1/company-config/{id} — save config for a specific company</summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCompanyConfigDto dto)
        => Ok(ApiResponse<CompanyConfigDto>.Ok(
            await svc.UpdateAsync(id, dto, CurrentUser),
            "Company configuration saved successfully."));
}
