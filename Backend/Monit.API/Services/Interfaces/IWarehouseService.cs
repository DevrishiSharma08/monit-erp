using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IWarehouseService
{
    Task<PagedResult<WarehouseListDto>>  GetAllAsync(WarehouseFilterRequest filter);
    Task<WarehouseDetailDto>             GetByIdAsync(int id);
    Task<List<WarehouseDropdownDto>>     GetDropdownAsync();
    Task<WarehouseDetailDto>             CreateAsync(CreateWarehouseDto dto, string createdBy);
    Task<WarehouseDetailDto>             UpdateAsync(int id, UpdateWarehouseDto dto, string updatedBy);
    Task                                 DeleteAsync(int id, string deletedBy);
    Task<byte[]>                         ExportAsync(WarehouseFilterRequest filter, string format);
}
