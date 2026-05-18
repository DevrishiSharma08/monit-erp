using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Repositories.Interfaces;

public interface IStockLotRepository
{
    Task<PagedResult<StockLotRow>>  GetAllAsync(StockLotFilterRequest filter);
    Task<StockLotDetailRow?>        GetByIdAsync(int id);
    Task                            UpdateAsync(int id, UpdateStockLotDto dto, string updatedBy);
    Task                            SoftDeleteAsync(int id, string deletedBy);
}
