using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Sales;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Sales;

public class SalesOrderService(ISalesOrderRepository repo) : ISalesOrderService
{
    public Task<PagedResult<SalesOrderListDto>> GetAllAsync(SalesOrderFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<SalesOrderListDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id)
           ?? throw new KeyNotFoundException($"Sales Order #{id} not found.");

    public async Task<SalesOrderListDto> CreateAsync(CreateSalesOrderDto dto, string createdBy)
    {
        Validate(dto);
        var id = await repo.CreateAsync(dto, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<SalesOrderListDto> UpdateAsync(int id, UpdateSalesOrderDto dto, string updatedBy)
    {
        Validate(dto);
        await repo.UpdateAsync(id, dto, updatedBy);
        return await GetByIdAsync(id);
    }

    private static void Validate(CreateSalesOrderDto dto)
    {
        var errors = new List<string>();
        if (dto.Lines.Count == 0)
            errors.Add("A sales order must have at least one line.");
        foreach (var l in dto.Lines)
        {
            if (l.OrderedQty <= 0)
                errors.Add($"Line {l.LineNumber}: ordered quantity must be greater than zero.");
            if (l.Rate < 0)
                errors.Add($"Line {l.LineNumber}: rate cannot be negative.");
        }
        if (errors.Count > 0) throw new ValidationException(errors);
    }

    public Task DeleteAsync(int id, string deletedBy)
        => repo.SoftDeleteAsync(id, deletedBy);
}
