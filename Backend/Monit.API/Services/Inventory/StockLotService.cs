using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Inventory;

public class StockLotService(IStockLotRepository repo) : IStockLotService
{
    public async Task<PagedResult<StockLotRow>> GetAllAsync(StockLotFilterRequest filter)
        => await repo.GetAllAsync(filter);

    public async Task<StockLotDetailRow> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Stock lot {id} not found.");

    public async Task<StockLotDetailRow> UpdateAsync(int id, UpdateStockLotDto dto, string updatedBy)
    {
        _ = await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Stock lot {id} not found.");

        if (dto.CurrentQty.HasValue && dto.CurrentQty < 0)
            throw new InvalidOperationException("CurrentQty cannot be negative.");

        await repo.UpdateAsync(id, dto, updatedBy);
        return (await repo.GetByIdAsync(id))!;
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        var lot = await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Stock lot {id} not found.");

        if (lot.AllocatedQty > 0)
            throw new InvalidOperationException(
                $"Cannot delete stock lot with allocated qty ({lot.AllocatedQty}). Deallocate first.");

        await repo.SoftDeleteAsync(id, deletedBy);
    }
}
