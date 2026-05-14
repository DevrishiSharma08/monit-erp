using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface ILocalityService
{
    Task<PagedResult<LocalityListDto>>  GetAllAsync(LocalityFilterRequest filter);
    Task<LocalityDetailDto>             GetByIdAsync(int id);
    Task<List<LocalityDropdownDto>>     GetDropdownAsync();
    Task<LocalityDetailDto>             CreateAsync(CreateLocalityDto dto, string createdBy);
    Task<LocalityDetailDto>             UpdateAsync(int id, UpdateLocalityDto dto, string updatedBy);
    Task                                DeleteAsync(int id, string deletedBy);
    Task<byte[]>                        ExportAsync(LocalityFilterRequest filter, string format);
}
