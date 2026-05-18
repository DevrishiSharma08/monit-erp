using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Repositories.Interfaces;

public interface ITruckLoadPlanRepository
{
    Task<PagedResult<TruckLoadPlanDto>> GetAllAsync(TruckLoadPlanFilterRequest filter);
    Task<TruckLoadPlanDto?>             GetByIdAsync(int id);
    Task<int>                           CreateAsync(CreateTruckLoadPlanDto dto, string planNumber, string createdBy);
    Task                                UpdateStatusAsync(int id, UpdateTruckLoadPlanStatusDto dto, string updatedBy);
    Task                                SoftDeleteAsync(int id, string deletedBy);
    Task<int>                           CountAsync();
}
