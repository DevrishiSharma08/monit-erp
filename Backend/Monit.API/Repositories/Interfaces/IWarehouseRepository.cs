using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IWarehouseRepository
{
    Task<PagedResult<WarehouseListDto>>  GetAllAsync(WarehouseFilterRequest filter);
    Task<List<WarehouseListDto>>         GetAllForExportAsync(WarehouseFilterRequest filter);
    Task<WarehouseDetailDto?>            GetByIdAsync(int id);
    Task<List<WarehouseDropdownDto>>     GetDropdownAsync();
    Task<int>                            CreateAsync(Warehouse warehouse, IEnumerable<(WarehouseBin bin, IEnumerable<WarehouseRack> racks)> bins, string createdBy);
    Task                                 UpdateAsync(Warehouse warehouse, IEnumerable<(WarehouseBin bin, IEnumerable<WarehouseRack> racks)> bins, string updatedBy);
    Task                                 SoftDeleteAsync(int id, string deletedBy);
}
