using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Services.Interfaces;

public interface ITruckLoadPlanService
{
    Task<PagedResult<TruckLoadPlanDto>> GetAllAsync(TruckLoadPlanFilterRequest filter);
    Task<TruckLoadPlanDto>              GetByIdAsync(int id);
    Task<TruckLoadPlanDto>              CreateAsync(CreateTruckLoadPlanDto dto, string createdBy);
    Task<TruckLoadPlanDto>              UpdateStatusAsync(int id, UpdateTruckLoadPlanStatusDto dto, string updatedBy);
    Task                                DeleteAsync(int id, string deletedBy);
}
