using Monit.API.Models.DTOs.Dashboard;

namespace Monit.API.Services.Interfaces;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync();
}
