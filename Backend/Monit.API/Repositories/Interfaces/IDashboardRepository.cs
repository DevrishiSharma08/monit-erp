using Monit.API.Models.DTOs.Dashboard;

namespace Monit.API.Repositories.Interfaces;

public interface IDashboardRepository
{
    Task<DashboardSummaryDto> GetSummaryAsync();
}
