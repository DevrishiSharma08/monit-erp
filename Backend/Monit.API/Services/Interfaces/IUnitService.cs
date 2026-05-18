using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IUnitService
{
    Task<PagedResult<UnitListDto>> GetAllAsync(UnitFilterRequest filter);
    Task<UnitDetailDto>            GetByIdAsync(int id);
    Task<List<UnitDropdownDto>>    GetDropdownAsync();
    Task<UnitDetailDto>            CreateAsync(CreateUnitDto dto, string createdBy);
    Task<UnitDetailDto>            UpdateAsync(int id, UpdateUnitDto dto, string updatedBy);
    Task                           DeleteAsync(int id, string deletedBy);
}
