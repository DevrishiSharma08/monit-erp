using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Inventory;

// ───────────────────────────────────────────────────────────────────────────────
// Delivery Challan — outward shipment to customer.
// Closes the loop: SO → … → GRN → StockLot → DeliveryChallan → SO closed.
// Each line points to ONE source: either an inventory.StockLots row (from-stock
// sale) or an inventory.GRNs row (direct-from-mill sale).
// ───────────────────────────────────────────────────────────────────────────────

public class DeliveryChallanItemDto
{
    public int      Id                  { get; set; }
    public int      ChallanId           { get; set; }
    public int      SalesOrderLineId    { get; set; }
    public int?     StockLotId          { get; set; }
    public int?     GrnId               { get; set; }
    public int?     MaterialId          { get; set; }
    public string?  Paper               { get; set; }
    public int?     Gsm                 { get; set; }
    public string?  Size                { get; set; }
    public decimal  QuantityKg          { get; set; }
    public decimal? Rate                { get; set; }
    public string?  Remarks             { get; set; }

    // ── Display-only (joined server-side) ────────────────────────────────────
    public string?  LotNumber           { get; set; }   // when sourced from StockLots
    public string?  BinLocation         { get; set; }   // when sourced from StockLots
    public string?  GrnNumber           { get; set; }   // when sourced from GRN
    public string?  PoNumber            { get; set; }   // chain hint
    public int?     SoLineNumber        { get; set; }
    // For the PDF's HSN-wise GST summary — via MaterialId -> HsnCodeId.
    public string?  HsnCode             { get; set; }
    public decimal? GstPercent          { get; set; }
}

public class DeliveryChallanDto
{
    public int      Id                  { get; set; }
    public string   ChallanNumber       { get; set; } = string.Empty;
    public string   ChallanDate         { get; set; } = string.Empty;
    public int      SalesOrderId        { get; set; }
    public string?  SoNumber            { get; set; }       // joined
    public int      CustomerId          { get; set; }
    public string?  CustomerName        { get; set; }
    public string   DeliveryMode        { get; set; } = "FromStock";
    public string?  DispatchedFrom      { get; set; }
    public string?  VehicleNumber       { get; set; }
    public string?  TransporterName     { get; set; }
    public string?  LRNumber            { get; set; }
    public string?  DriverName          { get; set; }
    public string?  DriverPhone         { get; set; }
    public decimal? FreightAmount       { get; set; }
    public string?  DeliveryAddress     { get; set; }
    public string?  EWayBillNumber      { get; set; }
    public string?  Remarks             { get; set; }
    public string   Status              { get; set; } = "Draft";
    public DateTime CreatedAt           { get; set; }
    public string?  CreatedBy           { get; set; }

    // ── Aggregates ───────────────────────────────────────────────────────────
    public int      ItemCount           { get; set; }
    public decimal  TotalQuantityKg     { get; set; }

    // ── PDF-only fields (joined server-side, not editable on the DC itself) ──
    // The DC table has no GST/payment-terms/buyer-address of its own — these
    // are borrowed from the linked Sales Order / Customer master purely for
    // printing the Delivery Note (client-requested format, 2026-09-30).
    public string?  CustomerGstNo       { get; set; }   // masters.Customers.GSTNo
    public string?  CustomerAddress     { get; set; }   // masters.Customers.BillingAddress (Buyer block)
    public string?  SoOrderDate         { get; set; }   // sales.SalesOrders.OrderDate ("Buyer's Order No" dated)
    public string?  PaymentTerms        { get; set; }   // SO's PaymentTerms, falls back to Customer's default

    public List<DeliveryChallanItemDto> Items { get; set; } = [];
}

// ── Create / Update ──────────────────────────────────────────────────────────

public class CreateDeliveryChallanItemDto
{
    public int      SalesOrderLineId    { get; set; }
    public int?     StockLotId          { get; set; }
    public int?     GrnId               { get; set; }
    public decimal  QuantityKg          { get; set; }
    public decimal? Rate                { get; set; }
    public string?  Remarks             { get; set; }
}

public class CreateDeliveryChallanDto
{
    public string   ChallanDate         { get; set; } = string.Empty;
    public int      SalesOrderId        { get; set; }
    public int      CustomerId          { get; set; }
    public string   DeliveryMode        { get; set; } = "FromStock";
    public string?  DispatchedFrom      { get; set; }
    public string?  VehicleNumber       { get; set; }
    public string?  TransporterName     { get; set; }
    public string?  LRNumber            { get; set; }
    public string?  DriverName          { get; set; }
    public string?  DriverPhone         { get; set; }
    public decimal? FreightAmount       { get; set; }
    public string?  DeliveryAddress     { get; set; }
    public string?  EWayBillNumber      { get; set; }
    public string?  Remarks             { get; set; }

    public List<CreateDeliveryChallanItemDto> Items { get; set; } = [];
}

public class UpdateDeliveryChallanStatusDto
{
    public string   Status              { get; set; } = string.Empty;
    public string?  Remarks             { get; set; }
}

// ── Filter ───────────────────────────────────────────────────────────────────

public class DeliveryChallanFilterRequest : FilterRequest
{
    public string? Status          { get; set; }
    public int?    SalesOrderId    { get; set; }
    public int?    CustomerId      { get; set; }
    public string? ChallanNumber   { get; set; }
}

// ── Open-SO / Available-stock pickers ────────────────────────────────────────
// These power the Create DC modal so the user can pick from real data.

public class OpenSoLineForDcDto
{
    public int      SalesOrderId        { get; set; }   // used to attach to parent header
    public int      SalesOrderLineId    { get; set; }
    public int      LineNumber          { get; set; }
    public int?     MaterialId          { get; set; }
    public string?  Paper               { get; set; }
    public int?     Gsm                 { get; set; }
    public string?  Size                { get; set; }
    public decimal  OrderedQty          { get; set; }
    public decimal  DeliveredQty        { get; set; }
    public decimal  PendingQty          { get; set; }
    public decimal? Rate                { get; set; }
    public string?  DeliveryAddress     { get; set; }
}

public class OpenSoForDcDto
{
    public int      SalesOrderId        { get; set; }
    public string   SoNumber            { get; set; } = string.Empty;
    public string?  OrderDate           { get; set; }
    public int      CustomerId          { get; set; }
    public string?  CustomerName        { get; set; }
    public string?  Status              { get; set; }
    public string?  RequiredDeliveryDate{ get; set; }
    public decimal  TotalOrderedQty     { get; set; }
    public decimal  TotalDeliveredQty   { get; set; }
    public decimal  TotalPendingQty     { get; set; }
    // True when at least one pending line has stock actually available to
    // pick against right now (pooled stock lot, or a Direct-GRN portion
    // earmarked for this SO) — computed the same way the Create Challan
    // modal's per-line "sources" lookup does, but batched for the whole
    // list so the grid can show it upfront instead of the user having to
    // open each SO to find out it has nothing to deliver yet.
    public bool     HasAvailableStock   { get; set; }
    public List<OpenSoLineForDcDto> Lines { get; set; } = [];
}

public class AvailableStockSourceDto
{
    // Either StockLotId is set (from-stock) or GrnId is set (direct-from-mill).
    public int?     StockLotId          { get; set; }
    public string?  LotNumber           { get; set; }
    public int?     WarehouseId         { get; set; }
    public string?  WarehouseName       { get; set; }
    public string?  BinLocation         { get; set; }
    public int?     FifoSequence        { get; set; }

    public int?     GrnId               { get; set; }
    public string?  GrnNumber           { get; set; }
    public string?  PoNumber            { get; set; }

    public int?     MaterialId          { get; set; }
    public string?  Paper               { get; set; }
    public int?     Gsm                 { get; set; }
    public string?  Size                { get; set; }
    public decimal  AvailableQty        { get; set; }   // kg
    public decimal? CostPerUnit         { get; set; }
    public string   SourceType          { get; set; } = "Stock";  // "Stock" | "DirectGrn"

    // ── Transport snapshot (only populated for DirectGrn rows) ───────────────
    // The DC form pre-fills these fields the first time a Direct-GRN source is
    // picked, so the user doesn't have to retype what's already on the GRN /
    // parent dispatch receipt.
    public string?  VehicleNumber       { get; set; }
    public string?  LRNumber            { get; set; }
    public string?  TransporterName     { get; set; }
    public string?  DriverName          { get; set; }
    public string?  DriverPhone         { get; set; }
}
