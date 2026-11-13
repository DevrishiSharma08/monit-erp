using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Services.Interfaces;

public interface IDispatchReceiptService
{
    Task<PagedResult<DispatchReceiptDto>> GetAllAsync(DispatchReceiptFilterRequest filter);
    Task<DispatchReceiptDto>              GetByIdAsync(int id);
    Task<List<PendingTlpForDispatchDto>>  GetPendingTlpsAsync();
    Task<DispatchReceiptDto>              CreateAsync(CreateDispatchReceiptDto dto, string createdBy);
    Task<DispatchReceiptDto>              UpdateAsync(int id, UpdateDispatchReceiptDto dto, string updatedBy);
    Task                                  DeleteAsync(int id, string deletedBy);
}
