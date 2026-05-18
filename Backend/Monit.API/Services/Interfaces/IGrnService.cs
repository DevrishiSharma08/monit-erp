using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Services.Interfaces;

public interface IGrnService
{
    Task<PagedResult<GrnListDto>> GetAllAsync(GrnFilterRequest filter);
    Task<GrnDetailDto>            GetByIdAsync(int id);
    Task<GrnListDto>              CreateAsync(CreateGrnDto dto, string createdBy);
    Task<GrnDetailDto>            UpdateAsync(int id, UpdateGrnDto dto, string updatedBy);
    Task<GrnDetailDto>            UpdateStatusAsync(int id, UpdateGrnStatusDto dto, string updatedBy);
    Task                          DeleteAsync(int id, string deletedBy);
}
