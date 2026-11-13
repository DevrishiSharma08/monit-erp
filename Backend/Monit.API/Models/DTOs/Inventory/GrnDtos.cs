using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Inventory;

// ─── GRN list row (grid display) ─────────────────────────────────────────────

public class GrnListDto
{
    public int      Id                    { get; set; }
    public string   GrnNumber             { get; set; } = string.Empty;
    public string   GrnDate               { get; set; } = string.Empty;
    public string   Status                { get; set; } = string.Empty;

    // PO / Tracker
    public int      PoId                  { get; set; }
    public string   PoNumber              { get; set; } = string.Empty;
    public int?     MillTrackerId         { get; set; }
    public int?     SourceLoadPlanId      { get; set; }
    public string?  LoadPlanNumber        { get; set; }

    // Mill / Material
    public int      MillId                { get; set; }
    public string   MillName              { get; set; } = string.Empty;
    // Picked unit on the source PO (when present) — surfaced so the GRN
    // grid can display Mill column unit-aware like MOT / PO grids:
    // unit name primary, mill name as fallback.
    public string?  MillUnitName          { get; set; }
    public int      MaterialId            { get; set; }
    public string   Paper                 { get; set; } = string.Empty;
    public int?     Gsm                   { get; set; }
    public string?  Size                  { get; set; }

    // Quantities
    public decimal  OrderedQty            { get; set; }
    public decimal  PreviouslyReceivedQty { get; set; }
    public decimal  ReceivedQty           { get; set; }
    public decimal  ShortQty              { get; set; }
    public decimal  DamagedQty            { get; set; }
    public decimal  BalanceQty            { get; set; }
    public decimal? ReceivedWeightMt      { get; set; }

    // Delivery routing
    // StockIn → all good qty to StockLots
    // DirectToClient → all good qty to client, no StockLot
    // Split → StockQty to inventory, DirectQty to client
    public string   GrnDeliveryMode       { get; set; } = "StockIn";
    public decimal  StockQty              { get; set; }
    public decimal  DirectQty             { get; set; }
    public int?     DirectClientId        { get; set; }
    public string?  DirectClientName      { get; set; }

    // PO billing mode (from PurchaseOrders)
    // Normal → standard; InvoiceOverride → mill sees agency name; Blind → mill sees no client
    public string   BillingMode           { get; set; } = "Normal";
    public bool     BlindShipment         { get; set; }

    // Warehouse
    public int?     WarehouseId           { get; set; }
    public string?  WarehouseName         { get; set; }
    public string?  BinLocation           { get; set; }
    public string?  LotNumber             { get; set; }

    // Transport
    public string?  VehicleNumber         { get; set; }
    public string?  LrNumber              { get; set; }
    public string?  DispatchDate          { get; set; }

    // Quality
    public string?  Condition             { get; set; }
    public string?  QcResult              { get; set; }
    public string?  QualityGrade          { get; set; }

    // Linked SO / Customer
    public int?     LinkedSoId            { get; set; }
    public string?  LinkedSoNumber        { get; set; }
    public string?  CustomerName          { get; set; }   // effective real client
    public string?  EffectiveClientName   { get; set; }

    // Billing & Packing
    public string?  ItemInvoiceNo         { get; set; }
    public decimal? BillingRate           { get; set; }
    public string   PackingType           { get; set; } = "Sheets";
    public int?     SheetsPerPacket       { get; set; }
    public int?     PacketsPerBundle      { get; set; }
    public int?     NoOfPackets           { get; set; }
    public int?     NoOfBundles           { get; set; }

    // Audit
    public string   CreatedBy             { get; set; } = string.Empty;
    public DateTime CreatedAt             { get; set; }
}

// ─── GRN detail (includes full chain: SO → PO → TLP → GRN) ──────────────────

public class GrnDetailDto : GrnListDto
{
    public string?  PurchaseInvoiceNumber { get; set; }
    public string?  MillChallanNumber     { get; set; }
    public decimal? ExpectedWeightMt      { get; set; }
    public string?  SuggestedBin          { get; set; }
    public string?  DriverName            { get; set; }
    public string?  ReceivedBy            { get; set; }
    public decimal  FreightAmount         { get; set; }
    public decimal  UnloadingCharges      { get; set; }
    public bool     InvoiceEligible       { get; set; }
    public string?  Remarks               { get; set; }
    public string?  QcApprovedBy          { get; set; }
    public string?  QcDate                { get; set; }

    // PO billing detail (extra for view/print)
    public string?  OverrideClientName    { get; set; }  // what mill sees in InvoiceOverride mode
    public string?  DirectDeliveryAddress { get; set; }  // for direct-to-client print

    // Linked SO detail (for the chain display in View modal)
    public string?  SoDate                { get; set; }
    public string?  SoCustomerName        { get; set; }
    public string?  SoSalesmanName        { get; set; }
    public decimal? SoOrderedQty          { get; set; }
    public decimal? SoRate                { get; set; }

    // Linked PO detail
    public string?  PoDate                { get; set; }
    public string?  PoSupplierName        { get; set; }
    public decimal? PoRate                { get; set; }

    // TLP detail
    public string?  TlpDate              { get; set; }
    public string?  TlpTruckNumber       { get; set; }
    public string?  TlpTransporter       { get; set; }

    // Dispatch link (new — first-stage receipt before warehouse takes over)
    public int?     DispatchReceiptId    { get; set; }
    public string?  DispatchNumber       { get; set; }

    // Multi-row packings (replaces the flat PackingType/SheetsPerPacket fields
    // for new GRNs. Legacy fields on GrnListDto remain for back-compat.)
    public List<GrnPackingDto> Packings  { get; set; } = [];

    // Status log
    public List<GrnStatusLogDto> StatusLog { get; set; } = [];
}

// ─── GRN packing row (child of GRN — supports multiple per GRN) ─────────────
// PackingFormat: 'Sheet'  — sheets/packets/bundles populated, BatchNo NULL
//                'Reel'   — BatchNo + WeightKg, sheet fields NULL

public class GrnPackingDto
{
    public int      Id               { get; set; }
    public int      GrnId            { get; set; }
    public string   PackingFormat    { get; set; } = "Sheet";   // 'Sheet' | 'Reel'

    // Sheet packing
    public int?     SheetsPerPacket  { get; set; }
    public int?     NoOfPackets      { get; set; }
    public int?     PacketsPerBundle { get; set; }
    public int?     NoOfBundles      { get; set; }

    // Reel packing
    public string?  BatchNo          { get; set; }

    // Common
    public decimal  WeightKg         { get; set; }
    public string?  Remarks          { get; set; }
}

public class CreateGrnPackingDto
{
    public string   PackingFormat    { get; set; } = "Sheet";
    public int?     SheetsPerPacket  { get; set; }
    public int?     NoOfPackets      { get; set; }
    public int?     PacketsPerBundle { get; set; }
    public int?     NoOfBundles      { get; set; }
    public string?  BatchNo          { get; set; }
    public decimal  WeightKg         { get; set; }
    public string?  Remarks          { get; set; }
}

// ─── Status log entry ─────────────────────────────────────────────────────────

public class GrnStatusLogDto
{
    public string?  FromStatus { get; set; }
    public string   ToStatus   { get; set; } = string.Empty;
    public string?  Remarks    { get; set; }
    public string   ChangedBy  { get; set; } = string.Empty;
    public DateTime ChangedAt  { get; set; }
}

// ─── Create GRN ──────────────────────────────────────────────────────────────
// Backend resolves PO/Material/Mill details from MillTrackerId.
// Backend auto-generates: GRNNumber, LotNumber, Status.

public class CreateGrnDto
{
    public int      MillTrackerId         { get; set; }   // resolves PO/Material/Mill
    public int?     SourceLoadPlanId      { get; set; }   // the TLP that delivered
    public int?     DispatchReceiptId     { get; set; }   // first-stage receipt this GRN consumes
    public string   GrnDate               { get; set; } = string.Empty;

    // Invoice / challan refs
    public string?  PurchaseInvoiceNumber { get; set; }
    public string?  MillChallanNumber     { get; set; }
    public string?  DispatchDate          { get; set; }
    public string?  ItemInvoiceNo         { get; set; }
    public decimal? BillingRate           { get; set; }

    // Quantities
    public decimal  ReceivedQty           { get; set; }
    public decimal  DamagedQty            { get; set; }
    public decimal  ShortQty              { get; set; }
    public decimal? ReceivedWeightMt      { get; set; }

    // Warehouse
    public int?     WarehouseId           { get; set; }
    public int?     BinLocationId         { get; set; }

    // Quality
    public string?  Condition             { get; set; }
    public string?  QcResult              { get; set; }   // Accepted / Hold / Rejected / Accepted with Remark
    public string?  QualityGrade          { get; set; }

    // Delivery routing
    // StockIn (default) / DirectToClient / Split
    public string   GrnDeliveryMode       { get; set; } = "StockIn";
    // For Split: qty going direct to client. For DirectToClient: auto-set server-side.
    public decimal  DirectQty             { get; set; }
    // Optional override; if null, server auto-resolves from PO/Tracker
    public int?     DirectClientId        { get; set; }

    // Transport
    public string?  LrNumber              { get; set; }
    public string?  VehicleNumber         { get; set; }
    public string?  DriverName            { get; set; }

    // Financials
    public decimal  FreightAmount         { get; set; }
    public decimal  UnloadingCharges      { get; set; }
    public bool     InvoiceEligible       { get; set; } = true;

    // Packing format — legacy flat fields (kept for back-compat with old GRN
    // entries). For new GRNs prefer the Packings list below which supports
    // multiple rows and reel batch-wise tracking.
    public string   PackingType           { get; set; } = "Sheets";
    public int?     SheetsPerPacket       { get; set; }
    public int?     PacketsPerBundle      { get; set; }
    public int?     NoOfPackets           { get; set; }
    public int?     NoOfBundles           { get; set; }

    // Multi-row packings (new). Sheet → fill SheetsPerPacket/NoOfPackets etc.
    // Reel  → fill BatchNo + WeightKg per batch.
    public List<CreateGrnPackingDto> Packings { get; set; } = [];

    // Misc
    public string?  ReceivedBy            { get; set; }
    public string?  Remarks               { get; set; }
}

// ─── Update GRN (warehouse / bin / remarks only — editable post-creation) ────

public class UpdateGrnDto
{
    public int?    WarehouseId    { get; set; }
    public int?    BinLocationId  { get; set; }
    public string? Remarks        { get; set; }
    public string? ReceivedBy     { get; set; }
}

// ─── Status transition ────────────────────────────────────────────────────────

public class UpdateGrnStatusDto
{
    public string  Status        { get; set; } = string.Empty;
    public string? Remarks       { get; set; }
    public string? QcApprovedBy  { get; set; }
    public string? QcDate        { get; set; }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class GrnFilterRequest : FilterRequest
{
    public string? Status    { get; set; }
    public string? MillId    { get; set; }
    public string? GrnDate   { get; set; }
    public string? PoId      { get; set; }
}
