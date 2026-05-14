using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IItemTypeService
{
    Task<PagedResult<ItemTypeListDto>>  GetAllAsync(ItemTypeFilterRequest filter);
    Task<ItemTypeDetailDto>             GetByIdAsync(int id);
    Task<List<ItemTypeDropdownDto>>     GetDropdownAsync();
    Task<ItemTypeDetailDto>             CreateAsync(CreateItemTypeDto dto, string createdBy);
    Task<ItemTypeDetailDto>             UpdateAsync(int id, UpdateItemTypeDto dto, string updatedBy);
    Task                                DeleteAsync(int id, string deletedBy);
    Task<byte[]>                        ExportAsync(ItemTypeFilterRequest filter, string format);
}
