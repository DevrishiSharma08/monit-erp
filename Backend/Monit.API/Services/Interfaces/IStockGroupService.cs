using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IStockGroupService
{
    Task<PagedResult<StockGroupListDto>>  GetAllAsync(StockGroupFilterRequest filter);
    Task<StockGroupDetailDto>             GetByIdAsync(int id);
    Task<List<StockGroupDropdownDto>>     GetDropdownAsync();
    Task<List<SubGroupDropdownDto>>       GetSubGroupsDropdownAsync();
    Task<StockGroupDetailDto>             CreateAsync(CreateStockGroupDto dto, string createdBy);
    Task<StockGroupDetailDto>             UpdateAsync(int id, UpdateStockGroupDto dto, string updatedBy);
    Task                                  DeleteAsync(int id, string deletedBy);
    Task<byte[]>                          ExportAsync(StockGroupFilterRequest filter, string format);
}
