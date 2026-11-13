using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Repositories.Interfaces;

public interface IDispatchReceiptRepository
{
    Task<PagedResult<DispatchReceiptDto>> GetAllAsync(DispatchReceiptFilterRequest filter);
    Task<DispatchReceiptDto?>             GetByIdAsync(int id);

    // TLPs that have been Dispatched/Received but don't yet have a DispatchReceipt.
    // Surfaces on the Dispatch page for the dispatch user to pick up.
    Task<List<PendingTlpForDispatchDto>>  GetPendingTlpsAsync();

    Task<int>  CreateAsync(CreateDispatchReceiptDto dto, string dispatchNumber, string createdBy);
    Task       UpdateAsync(int id, UpdateDispatchReceiptDto dto, string updatedBy);
    Task       UpdateStatusAsync(int id, string status, string updatedBy);
    Task       SoftDeleteAsync(int id, string deletedBy);

    // True when at least one non-deleted GRN already references this
    // dispatch receipt — used to block Edit/Delete once goods have been
    // formally received (GRN is immutable-after-creation; letting the
    // upstream dispatch change under it would silently desync the GRN's
    // own snapshotted material/qty data and any stock lots already created
    // from it).
    Task<bool> HasGrnAsync(int dispatchReceiptId);
}

// ─── Display row for the Dispatch page "pending TLPs" list ────────────────────
// Only fields the dispatch user is allowed to see. No PO/SO context.

public class PendingTlpForDispatchDto
{
    public int      TlpId             { get; set; }
    public string   PlanNumber        { get; set; } = string.Empty;
    public string   PlanDate          { get; set; } = string.Empty;
    public string?  TruckNumber       { get; set; }
    public string?  TransporterName   { get; set; }
    public string?  Origin            { get; set; }       // mill name
    public string   Status            { get; set; } = string.Empty; // Dispatched / Received
    public int      ItemCount         { get; set; }
    public decimal  TotalWeightKg     { get; set; }

    // Item breakdown so the Pending Plans strip can render one row per item
    // (mill-tracker style) instead of one summary row per plan.
    public List<PendingTlpItemDto> Items { get; set; } = [];
}

// Per-item info shown inside the Pending Plans strip. Deliberately scoped to
// what the dispatch user is allowed to see — no PO/SO/customer context.
public class PendingTlpItemDto
{
    public int      ItemId       { get; set; }
    public string?  Paper        { get; set; }
    public int?     Gsm          { get; set; }
    public string?  Size         { get; set; }
    public decimal  WeightKg     { get; set; }
}
