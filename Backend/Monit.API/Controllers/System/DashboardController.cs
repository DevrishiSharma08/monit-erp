using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Helpers;
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
    {
        var result = await svc.GetSummaryAsync();
        if (RoleGuard.ShouldHideCost(User))
        {
            result.OpenSoValue = 0;
            result.OpenPoValue = 0;
            foreach (var row in result.RecentSalesOrders)    row.TotalValue = 0;
            foreach (var row in result.RecentPurchaseOrders) row.TotalValue = 0;
        }
        return Ok(ApiResponse<DashboardSummaryDto>.Ok(result));
    }
}
