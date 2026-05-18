using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IItemTypeRepository
{
    Task<PagedResult<ItemTypeListDto>>  GetAllAsync(ItemTypeFilterRequest filter);
    Task<List<ItemTypeListDto>>         GetAllForExportAsync(ItemTypeFilterRequest filter);
    Task<ItemTypeDetailDto?>            GetByIdAsync(int id);
    Task<List<ItemTypeDropdownDto>>     GetDropdownAsync();
    Task<bool>                          CodeExistsAsync(string code, int? excludeId = null);
    Task<int>                           CreateAsync(ItemType entity);
    Task                                UpdateAsync(ItemType entity);
    Task                                SoftDeleteAsync(int id, string deletedBy);
}
