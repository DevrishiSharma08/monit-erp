using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Dashboard;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Dashboard;

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController(IDashboardService svc) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
        => Ok(ApiResponse<DashboardSummaryDto>.Ok(await svc.GetSummaryAsync()));
}
