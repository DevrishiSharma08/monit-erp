using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Repositories.Interfaces;

public interface IGrnRepository
{
    Task<PagedResult<GrnListDto>>  GetAllAsync(GrnFilterRequest filter);
    Task<GrnDetailDto?>            GetByIdAsync(int id);

    // Returns the tracker context needed to resolve PO/Material/Mill on create
    Task<GrnTrackerContext?>       GetTrackerContextAsync(int trackerId);

    // Customer name lookup for direct-delivery client resolution
    Task<string?>                  GetCustomerNameAsync(int customerId);

    // Sum of ReceivedQty for all non-deleted GRNs against this tracker
    Task<decimal>                  GetPreviouslyReceivedQtyAsync(int trackerId);

    // Next auto-increment FIFO sequence for a given material (for StockLots)
    Task<int>                      GetNextFifoSequenceAsync(int materialId);

    // computed holds: GrnNumber, LotNumber, Status, PrevQty, DeliveryMode, DirectQty, StockQty, DirectClientId/Name
    Task<GrnListDto>               CreateAsync(CreateGrnDto dto, GrnTrackerContext ctx,
                                               GrnComputedValues computed, string createdBy);

    Task                           UpdateAsync(int id, UpdateGrnDto dto, string updatedBy);
    Task                           UpdateStatusAsync(int id, UpdateGrnStatusDto dto, string updatedBy);
    Task                           LogStatusChangeAsync(int grnId, string? fromStatus, string toStatus,
                                                        string? remarks, string changedBy);

    Task                           CreateStockLotAsync(int grnId, GrnTrackerContext ctx,
                                                       string lotNumber, decimal qty,
                                                       decimal? costPerUnit, int fifoSeq, string createdBy);

    Task                           SoftDeleteAsync(int id, string deletedBy);
}

// ─── Tracker context resolved server-side before GRN creation ─────────────────

public class GrnTrackerContext
{
    public int      TrackerId             { get; set; }
    public int      PoId                  { get; set; }
    public string   PoNumber              { get; set; } = string.Empty;
    public int      MillId                { get; set; }
    public string   MillName              { get; set; } = string.Empty;
    public string   MillCode              { get; set; } = string.Empty;
    public int      MaterialId            { get; set; }
    public string   Paper                 { get; set; } = string.Empty;
    public string?  CategoryCode          { get; set; }
    public int?     Gsm                   { get; set; }
    public string?  Size                  { get; set; }
    public decimal  OrderedQty            { get; set; }
    public int?     LinkedSoId            { get; set; }
    public decimal  Rate                  { get; set; }

    // PO billing mode fields
    public string   BillingMode           { get; set; } = "Normal";
    public bool     BlindShipment         { get; set; }
    public string?  OverrideClientName    { get; set; }
    public int?     DirectCustomerId      { get; set; }   // from PO.DirectCustomerId
    public string?  DirectDeliveryAddress { get; set; }   // from PO

    // MillTracker customer (denormalized from linked SO)
    public int?     CustomerId            { get; set; }
    public string?  CustomerName          { get; set; }
}

// ─── Computed values passed from Service → Repository on Create ───────────────

public class GrnComputedValues
{
    public string   GrnNumber        { get; set; } = string.Empty;
    public string   LotNumber        { get; set; } = string.Empty;
    public string   Status           { get; set; } = string.Empty;
    public decimal  PrevQty          { get; set; }

    // Delivery routing
    public string   DeliveryMode     { get; set; } = "StockIn";
    public decimal  StockQty         { get; set; }
    public decimal  DirectQty        { get; set; }
    public int?     DirectClientId   { get; set; }
    public string?  DirectClientName { get; set; }
}
