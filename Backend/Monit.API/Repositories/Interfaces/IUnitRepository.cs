using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IUnitRepository
{
    Task<PagedResult<UnitListDto>> GetAllAsync(UnitFilterRequest filter);
    Task<List<UnitListDto>>        GetAllForExportAsync(UnitFilterRequest filter);
    Task<UnitDetailDto?>           GetByIdAsync(int id);
    Task<bool>                     NameExistsAsync(string name, int? excludeId = null);
    Task<int>                      CreateAsync(Unit entity);
    Task                           UpdateAsync(Unit entity);
    Task                           SoftDeleteAsync(int id, string deletedBy);
    Task<List<UnitDropdownDto>>    GetDropdownAsync();
}
