using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IStockGroupRepository
{
    Task<PagedResult<StockGroupListDto>>  GetAllAsync(StockGroupFilterRequest filter);
    Task<List<StockGroupListDto>>         GetAllForExportAsync(StockGroupFilterRequest filter);
    Task<StockGroupDetailDto?>            GetByIdAsync(int id);
    Task<List<StockGroupDropdownDto>>     GetDropdownAsync();
    Task<List<SubGroupDropdownDto>>       GetSubGroupsDropdownAsync();
    Task<bool>                            NameExistsAsync(string name, int? excludeId = null);
    Task<int>                             CreateAsync(StockGroup entity, List<SubgroupInputDto> subgroups);
    Task                                  UpdateAsync(StockGroup entity, List<SubgroupInputDto> subgroups);
    Task                                  SoftDeleteAsync(int id, string deletedBy);
}
