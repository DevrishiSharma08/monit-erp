using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Procurement;

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

public class MillTrackerBatchDto
{
    public int      Id            { get; set; }
    public int      TrackerId     { get; set; }
    public int      BatchNo       { get; set; }
    public string?  DeliveryDate  { get; set; }
    public decimal  Quantity      { get; set; }
    public string?  LrNumber      { get; set; }
    public string?  TruckNumber   { get; set; }
    public string?  VehicleNumber { get; set; }
    public string?  MillInvoiceNo { get; set; }
    public string?  Remarks       { get; set; }
    public DateTime CreatedAt     { get; set; }
    public string   CreatedBy     { get; set; } = string.Empty;
}

public class MillTrackerHistoryDto
{
    public int      Id             { get; set; }
    public int      TrackerId      { get; set; }
    public string?  Action         { get; set; }
    public string?  OldStatus      { get; set; }
    public string   NewStatus      { get; set; } = string.Empty;
    public decimal? OldQty         { get; set; }
    public decimal? NewQty         { get; set; }
    public decimal? ReadyQty       { get; set; }
    public decimal? DispatchedQty  { get; set; }
    public string?  Remarks        { get; set; }
    public string   UpdatedBy      { get; set; } = string.Empty;
    public DateTime UpdatedAt      { get; set; }
}

// ─── Main list / detail DTO ───────────────────────────────────────────────────

public class MillTrackerListDto
{
    public int      Id                 { get; set; }
    public int      PoId               { get; set; }
    public int?     PoItemId           { get; set; }
    public string   PoNumber           { get; set; } = string.Empty;
    public string?  PoDate             { get; set; }
    public int      MillId             { get; set; }
    public string   Mill               { get; set; } = string.Empty;
    public int?     MaterialId         { get; set; }
    public string?  Paper              { get; set; }
    // Brand = the quality's Alias (e.g. "Eco Polar"), NOT the quality name
    // itself. Joined on mat.QualityId so MOT grid + Excel template can show
    // it in its own column instead of forcing the user to parse it out of
    // `Paper`.
    public string?  BrandName          { get; set; }
    // The PO item line's own free-text Remark (distinct from `Remarks`
    // below, which is the tracker's own status note) — client-requested
    // 2026-11-06 so MOT shows what was typed per-item on the PO.
    public string?  ItemRemark         { get; set; }
    public int?     Gsm                { get; set; }
    public string?  Size               { get; set; }
    public decimal  OrderedQty         { get; set; }
    public decimal  ReadyQty           { get; set; }
    public decimal  DispatchedQty      { get; set; }
    public decimal  BalanceQty         { get; set; }
    public decimal  Rate               { get; set; }
    public decimal? Discount           { get; set; }
    public decimal  TotalAmount        { get; set; }
    public string   ProductionStatus   { get; set; } = "Order Placed";
    public decimal  ProductionProgress { get; set; }
    public string?  ExpectedDelivery   { get; set; }
    public string?  ActualDispatchDate { get; set; }
    public string?  LastUpdate         { get; set; }
    public string?  LastUpdatedBy      { get; set; }
    public int?     DelayDays          { get; set; }
    public int?     LinkedSOId         { get; set; }
    public string?  DeliveryMode       { get; set; }
    public string?  MillInvoiceNo      { get; set; }
    public string?  CustomerName       { get; set; }
    public int?     CustomerId         { get; set; }
    public string?  SoNumber           { get; set; }
    public string?  SoDeliveryDate     { get; set; }
    public int?     SoCustomerId       { get; set; }
    public string?  SoCustomerName     { get; set; }
    public string?  Remarks                { get; set; }
    public string?  MillSONumber           { get; set; }
    public string?  DirectDeliveryAddress  { get; set; }
    public string?  MillAddress            { get; set; }
    public int?     MillUnitId             { get; set; }
    public string?  MillUnitName           { get; set; }
    // Close-tracker flow (short-delivery final acceptance) — added per
    // client UAT so warehouse can finalise a tracker even when the mill
    // didn't ship the full ordered qty. Closed trackers drop out of the
    // default MOT grid view.
    public bool     IsClosed               { get; set; }
    public string?  ClosedAt               { get; set; }
    public string?  ClosedBy               { get; set; }
    public string?  CloseReason            { get; set; }
    public DateTime CreatedAt              { get; set; }

    public List<MillTrackerBatchDto>   Batches { get; set; } = [];
    public List<MillTrackerHistoryDto> History { get; set; } = [];
}

// ─── Mutation DTOs ────────────────────────────────────────────────────────────

public class UpdateMillTrackerStatusDto
{
    public string   Status            { get; set; } = string.Empty;
    public decimal? Progress          { get; set; }
    public decimal? ReadyQty          { get; set; }
    public string?  Note              { get; set; }
    public string?  ExpectedDelivery  { get; set; }
}

// Close tracker — mill has effectively fulfilled the order at whatever
// qty was received. Balance is treated as short delivery, tracker leaves
// the default MOT grid view. Reason is optional.
public class CloseMillTrackerDto
{
    public string?  Reason { get; set; }
}

public class BulkImportRowDto
{
    public string   PoNumber          { get; set; } = string.Empty;
    public decimal? ReadyQty          { get; set; }
    public string?  Status            { get; set; }
    public string?  ExpectedDelivery  { get; set; }
    public string?  Remarks           { get; set; }
}

public class BulkImportResultDto
{
    public int          Updated   { get; set; }
    public int          Unchanged { get; set; }   // row parsed fine but nothing actually differed — left untouched, no history entry
    public int          Skipped   { get; set; }
    public List<string> Errors    { get; set; } = [];
    // Row parsed and other edited fields (Ready/ExpectedDelivery/Remarks) were
    // still applied — only a typed "Dispatched"/"Partial Dispatched" status
    // was dropped, since dispatch can only be recorded from the Dispatch page.
    public List<string> Warnings  { get; set; } = [];
}

// Excel-based bulk update (the user downloads the grid as xlsx, edits the
// Ready Qty / Status / Expected Delivery cells, uploads it back). Matching
// keyed on the tracker Id column so multiple trackers per PO disambiguate
// cleanly — the old CSV path matched by PO Number and updated every tracker
// under that PO with the same row, which was wrong for multi-item POs.
public class BulkImportExcelRowDto
{
    public int      Id                { get; set; }
    public decimal? ReadyQty          { get; set; }
    public string?  Status            { get; set; }
    public string?  ExpectedDelivery  { get; set; }
    public string?  Remarks           { get; set; }
}

public class AddMillTrackerBatchDto
{
    public string   DeliveryDate  { get; set; } = string.Empty;
    public decimal  Quantity      { get; set; }
    public string?  LrNumber      { get; set; }
    public string?  TruckNumber   { get; set; }
    public string?  VehicleNumber { get; set; }
    public string?  MillInvoiceNo { get; set; }
    public string?  Remarks       { get; set; }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class MillTrackerFilterRequest : FilterRequest
{
    public int?    PoId       { get; set; }
    public int?    MillId     { get; set; }
    public string? Status     { get; set; }
    public int?    CustomerId { get; set; }
    // null / "active" (default) — only IsClosed = 0
    // "closed"                  — only IsClosed = 1
    // "all"                     — no filter
    public string? Closed     { get; set; }
}
