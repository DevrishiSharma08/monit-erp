using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Repositories.Interfaces;

public interface IPurchaseOrderRepository
{
    Task<PagedResult<PurchaseOrderListDto>> GetAllAsync(PurchaseOrderFilterRequest filter);
    Task<PurchaseOrderListDto?>             GetByIdAsync(int id);
    Task<int>                               CreateAsync(PurchaseOrderListDto po, IEnumerable<UpsertPurchaseOrderItemDto> items, string createdBy);
    Task                                    UpdateAsync(int id, PurchaseOrderListDto po, IEnumerable<UpsertPurchaseOrderItemDto> items, string updatedBy);
    Task                                    UpdateStatusAsync(int id, string status, string updatedBy);
    Task                                    SoftDeleteAsync(int id, string deletedBy);
    Task                                    MarkEmailSentAsync(int id);
}
