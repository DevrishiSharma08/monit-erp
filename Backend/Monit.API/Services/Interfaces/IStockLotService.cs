using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Services.Interfaces;

public interface IStockLotService
{
    Task<PagedResult<StockLotRow>>  GetAllAsync(StockLotFilterRequest filter);
    Task<StockLotDetailRow>         GetByIdAsync(int id);
    Task<StockLotDetailRow>         UpdateAsync(int id, UpdateStockLotDto dto, string updatedBy);
    Task                            DeleteAsync(int id, string deletedBy);
}
