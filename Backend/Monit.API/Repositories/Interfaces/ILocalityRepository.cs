using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface ILocalityRepository
{
    Task<PagedResult<LocalityListDto>>  GetAllAsync(LocalityFilterRequest filter);
    Task<List<LocalityListDto>>         GetAllForExportAsync(LocalityFilterRequest filter);
    Task<LocalityDetailDto?>            GetByIdAsync(int id);
    Task<List<LocalityDropdownDto>>     GetDropdownAsync();
    Task<int>                           CreateAsync(Locality entity);
    Task                                UpdateAsync(Locality entity);
    Task                                SoftDeleteAsync(int id, string deletedBy);
}
