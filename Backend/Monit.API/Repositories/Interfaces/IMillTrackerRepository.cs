using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Repositories.Interfaces;

public interface IMillTrackerRepository
{
    Task<PagedResult<MillTrackerListDto>>  GetAllAsync(MillTrackerFilterRequest filter);
    Task<MillTrackerListDto?>              GetByIdAsync(int id);
    Task<List<MillTrackerListDto>>         GetByPoIdAsync(int poId);
    Task<List<MillTrackerListDto>>         GetByPoNumberAsync(string poNumber);
    Task                                   CreateForPoAsync(PurchaseOrderListDto po, string createdBy);
    Task                                   SyncForPoUpdateAsync(int poId, PurchaseOrderListDto oldPo, PurchaseOrderListDto updatedPo, string updatedBy);
    Task                                   UpdateStatusAsync(int id, UpdateMillTrackerStatusDto dto, string updatedBy);
    Task<MillTrackerBatchDto>              AddBatchAsync(int id, AddMillTrackerBatchDto batch, string createdBy);
    Task                                   SoftDeleteAsync(int id, string deletedBy);
}
