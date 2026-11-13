using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Inventory;

// ───────────────────────────────────────────────────────────────────────────────
// Dispatch Receipt — first stage of the receiving flow.
// A dispatch user enters basic info (invoice no, date, qty dispatched) from
// the mill's challan, without seeing PO/SO context. The warehouse user later
// converts this into a full GRN.
// ───────────────────────────────────────────────────────────────────────────────

public class DispatchReceiptItemDto
{
    public int      Id                  { get; set; }
    public int      DispatchReceiptId   { get; set; }
    public int?     SourceTrackerId     { get; set; }
    public int?     SourceTlpItemId     { get; set; }
    public int?     MaterialId          { get; set; }
    public decimal  DispatchedQty       { get; set; }   // kg
    public string?  ItemInvoiceNo       { get; set; }
    public string?  Remarks             { get; set; }

    // ── Display-only (joined from TLP/Material — never editable) ─────────────
    public string?  Paper               { get; set; }
    public int?     Gsm                 { get; set; }
    public string?  Size                { get; set; }
    public string?  ItemType            { get; set; }   // 'Sheet' | 'Reel'
    public string?  PoNumber            { get; set; }
}

public class DispatchReceiptDto
{
    public int      Id                  { get; set; }
    public string   DispatchNumber      { get; set; } = string.Empty;
    public string   DispatchDate        { get; set; } = string.Empty;
    public int      SourceLoadPlanId    { get; set; }
    public string?  LoadPlanNumber      { get; set; }
    public string?  TruckNumber         { get; set; }
    public string?  TransporterName     { get; set; }
    public string?  Origin              { get; set; }
    public string   InvoiceNumber       { get; set; } = string.Empty;
    public string?  InvoiceDate         { get; set; }
    public string?  MillChallanNumber   { get; set; }
    public string?  LRNumber            { get; set; }
    public string?  VehicleNumber       { get; set; }
    public string?  ReceivedBy          { get; set; }
    public string?  Remarks             { get; set; }
    public string   Status              { get; set; } = "Pending GRN";
    public DateTime CreatedAt           { get; set; }

    public List<DispatchReceiptItemDto> Items { get; set; } = [];
}

// ── Create / Update ──────────────────────────────────────────────────────────

public class CreateDispatchReceiptItemDto
{
    public int?     SourceTrackerId     { get; set; }
    public int?     SourceTlpItemId     { get; set; }
    public int?     MaterialId          { get; set; }
    public decimal  DispatchedQty       { get; set; }
    public string?  ItemInvoiceNo       { get; set; }
    public string?  Remarks             { get; set; }
    /// <summary>
    /// When true, the source mill tracker is closed after this dispatch
    /// (short-delivery finalisation). Balance qty is accepted as-is;
    /// tracker moves out of the default MOT grid.
    /// </summary>
    public bool     CloseTrackerAfter   { get; set; }
}

public class CreateDispatchReceiptDto
{
    public string   DispatchDate        { get; set; } = string.Empty;
    public int      SourceLoadPlanId    { get; set; }
    public string   InvoiceNumber       { get; set; } = string.Empty;
    public string?  InvoiceDate         { get; set; }
    public string?  MillChallanNumber   { get; set; }
    public string?  LRNumber            { get; set; }
    public string?  VehicleNumber       { get; set; }
    public string?  ReceivedBy          { get; set; }
    public string?  Remarks             { get; set; }

    public List<CreateDispatchReceiptItemDto> Items { get; set; } = [];
}

public class UpdateDispatchReceiptDto : CreateDispatchReceiptDto
{
    public string? Status { get; set; }
}

// ── Filter ───────────────────────────────────────────────────────────────────

public class DispatchReceiptFilterRequest : FilterRequest
{
    public string? Status         { get; set; }
    public string? InvoiceNumber  { get; set; }
}
