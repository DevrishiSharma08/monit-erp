using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IMillRepository
{
    Task<PagedResult<MillListDto>>  GetAllAsync(MillFilterRequest filter);
    Task<List<MillListDto>>         GetAllForExportAsync(MillFilterRequest filter);
    Task<MillDetailDto?>            GetByIdAsync(int id);
    Task<bool>                      CodeExistsAsync(string code, int? excludeId = null);
    Task<int>                       CreateAsync(Mill mill, List<MillUnitDto> units, string createdBy);
    Task                            UpdateAsync(Mill mill, List<MillUnitDto> units, string updatedBy);
    Task                            SoftDeleteAsync(int id, string deletedBy);
    Task<List<MillDropdownDto>>     GetDropdownAsync();
    Task<List<MillContactDto>>      GetContactsAsync(int millId);
}
