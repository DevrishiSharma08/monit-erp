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
    Task                                   CloseAsync(int id, string? reason, string closedBy);
    Task<MillTrackerBatchDto>              AddBatchAsync(int id, AddMillTrackerBatchDto batch, string createdBy);
    Task                                   SoftDeleteAsync(int id, string deletedBy);

    // Material/GSM/Size on a PO item (or the SO line it came from) must only
    // be editable while production hasn't started yet — once a mill has
    // reported any Ready/Dispatched/etc. progress against the ORIGINAL spec,
    // changing what was ordered would silently disagree with what's already
    // been produced. Both return only the BLOCKING entries (status != Order
    // Placed); an id absent from the result is safe to edit.
    Task<Dictionary<int, string>>          GetBlockingStatusesForPoItemsAsync(IEnumerable<int> poItemIds);
    Task<Dictionary<int, string>>          GetBlockingStatusesForSoLinesAsync(IEnumerable<int> soLineIds);
}
