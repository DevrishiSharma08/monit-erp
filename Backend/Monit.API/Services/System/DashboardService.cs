using Monit.API.Models.DTOs.Dashboard;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Dash;

public class DashboardService(IDashboardRepository repo) : IDashboardService
{
    public Task<DashboardSummaryDto> GetSummaryAsync() => repo.GetSummaryAsync();
}
