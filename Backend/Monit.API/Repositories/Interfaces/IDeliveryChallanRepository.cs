using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Repositories.Interfaces;

public interface IDeliveryChallanRepository
{
    // ── Queries ──────────────────────────────────────────────────────────────
    Task<PagedResult<DeliveryChallanDto>> GetAllAsync(DeliveryChallanFilterRequest filter);
    Task<DeliveryChallanDto?>             GetByIdAsync(int id);

    // Open Sales Orders (status != Completed/Cancelled) with at least one line
    // having Qty > DeliveredQty. Powers the customer/SO picker in Create DC.
    Task<List<OpenSoForDcDto>>            GetOpenSosAsync(int? customerId);

    // For a given SO line, returns every stock lot and every GRN with
    // direct-to-client portion that hasn't been fully consumed by prior DCs.
    Task<List<AvailableStockSourceDto>>   GetAvailableSourcesForSoLineAsync(int soLineId);

    // ── Mutations (one transaction wraps create + stock decrement + SO close) ─
    Task<int>  CreateAsync(CreateDeliveryChallanDto dto, string challanNumber, string createdBy);
    Task       UpdateStatusAsync(int id, string status, string? remarks, string updatedBy);
    Task       SoftDeleteAsync(int id, string deletedBy);

    // Auto-creates a Draft DC for the direct-to-client portion of a GRN.
    // Returns the new DC id if a matching open SO line is found, else null.
    // Silently skips (returns null) when no link can be resolved.
    Task<int?> AutoCreateDraftFromGrnAsync(int grnId, decimal directQty, string challanNumber, string createdBy);
}
