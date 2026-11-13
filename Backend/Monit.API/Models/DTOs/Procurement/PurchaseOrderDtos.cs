using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Procurement;

// ─── Item DTO ─────────────────────────────────────────────────────────────────

public class PurchaseOrderItemDto
{
    public int      Id             { get; set; }
    public int      LineNumber     { get; set; }
    public int?     MaterialId     { get; set; }   // null = free-text custom item code
    public string?  Description    { get; set; }
    // Pulled from materials → StockSubGroups.Alias — rendered as its own
    // column on the PO PDF / email so the mill sees brand cleanly without
    // the Item Code.
    public string?  BrandName      { get; set; }
    public int?     GSM            { get; set; }
    public string?  Size           { get; set; }
    public decimal  Quantity       { get; set; }
    public decimal? WeightKg       { get; set; }
    public string?  Unit           { get; set; }
    public decimal  Rate           { get; set; }
    public decimal? Discount       { get; set; }
    public decimal  Amount         { get; set; }
    public decimal  ReceivedQty    { get; set; }
    public decimal  PendingQty     { get; set; }
    public int?     LinkedSOLineId { get; set; }
    public string?  Remark         { get; set; }
}

// ─── List / Detail ────────────────────────────────────────────────────────────

public class PurchaseOrderListDto
{
    public int      Id                    { get; set; }
    public string   PONumber              { get; set; } = string.Empty;
    public int      MillId                { get; set; }
    public string   MillName              { get; set; } = string.Empty;
    public string?  MillCode              { get; set; }
    // GSTNo per the picked mill unit (falls back to mill-level when no unit
    // was chosen) — surfaced on the PO PDF "Order To" cell so the mill sees
    // its own GST printed on the order.
    public string?  MillGstNo             { get; set; }
    public int?     MillUnitId            { get; set; }
    public string?  MillUnitName          { get; set; }
    public string?  MillUnitAddress       { get; set; }
    public string   OrderDate             { get; set; } = string.Empty;
    public string   POType                { get; set; } = string.Empty;
    public int?     LinkedSOId            { get; set; }
    public string?  LinkedSONumber        { get; set; }
    // Customer info pulled from the linked SO — used by the PDF / view as
    // a fallback for the "Shipped To" cell when the PO didn't capture
    // DirectCustomer details directly (the SO already knows the end-customer
    // when the PO was raised against an SO).
    public string?  LinkedSOCustomerName     { get; set; }
    public string?  LinkedSOCustomerAddress  { get; set; }
    public string?  LinkedSOCustomerGstNo    { get; set; }
    // The SO's separate DELIVERY party (client-requested: SO placed by
    // Customer A, but goods ship to a different Customer B) — takes
    // priority over LinkedSOCustomer* above when the SO actually has one
    // set. Address comes from the SO's own first line (SalesOrderLines.
    // DeliveryAddress), same field the SO's own PDF/View already reads.
    public string?  LinkedSODeliveryPartyName    { get; set; }
    public string?  LinkedSODeliveryPartyAddress { get; set; }
    public string?  LinkedSODeliveryPartyGstNo   { get; set; }
    // User-controlled toggle (default false, client-requested): whether the
    // mill should see the SO's separate delivery party B instead of Customer
    // A on this specific PO. Off = today's unchanged default behaviour.
    public bool     ShowDeliveryParty     { get; set; }
    // User-controlled toggle (default false, client-requested 2026-09-11):
    // whether the "Customer : ..." reference line prints on the PDF at all.
    // Applies the same regardless of ShipmentMode — was previously always
    // shown, which leaked the real customer's identity on Blind POs.
    public bool     ShowCustomerName      { get; set; }
    public string?  DeliveryMode          { get; set; }
    public string?  ShipmentMode          { get; set; }
    public bool     BlindShipment         { get; set; }
    public string?  InvoiceParty          { get; set; }
    public int?     InvoicePartyId        { get; set; }
    // Master details of the picked override-invoice customer — surfaced on
    // the PO PDF / email "Shipped To" cell when ShipmentMode = InvoiceOverride.
    public string?  InvoicePartyGstNo     { get; set; }
    public string?  InvoicePartyAddress   { get; set; }
    public int?     DirectCustomerId      { get; set; }
    public string?  DirectCustomer        { get; set; }
    // GST + billing address of the picked direct customer — surfaced on the
    // PO PDF "Shipped To" cell so the mill sees the end-customer's GST.
    public string?  DirectCustomerGstNo   { get; set; }
    public string?  DirectCustomerAddress { get; set; }
    public string?  DirectDeliveryAddress { get; set; }
    public string?  ExpectedDeliveryDate  { get; set; }
    public string?  MillSONumber          { get; set; }
    public string?  PaymentTerms          { get; set; }
    public string?  InsurancePolicyNo     { get; set; }
    public decimal  TotalQuantity         { get; set; }
    public decimal  TotalValue            { get; set; }
    public string   Status                { get; set; } = string.Empty;
    public decimal? GSTPercentage         { get; set; }
    public string?  Remarks               { get; set; }
    public string?  SpecialInstructions   { get; set; }
    public DateTime CreatedAt             { get; set; }
    // True when this PO was entered as a backfill of a historical record
    // from the user's pre-system manual register. Auto-sequence was not
    // consumed; PONumber is the user-supplied original value.
    public bool     IsBackfilled          { get; set; }
    public string?  CancelReason          { get; set; }
    public string?  CancelledAt           { get; set; }
    public string?  CancelledBy           { get; set; }
    public string?  EmailSentAt           { get; set; }
    // Frontend compares this against EmailSentAt to show a "resend to mill?"
    // reminder when a PO was edited after it was last emailed out.
    public string?  UpdatedAt             { get; set; }
    public List<PurchaseOrderItemDto> Items { get; set; } = [];
}

public class CancelPurchaseOrderDto
{
    public string Reason { get; set; } = string.Empty;
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

public class UpsertPurchaseOrderItemDto
{
    public int      LineNumber     { get; set; }
    public int?     MaterialId     { get; set; }   // null = free-text custom item code
    public string?  Description    { get; set; }
    public int?     GSM            { get; set; }
    public string?  Size           { get; set; }
    public decimal  Quantity       { get; set; }
    public decimal? WeightKg       { get; set; }
    public string?  Unit           { get; set; }
    public decimal  Rate           { get; set; }
    public decimal? Discount       { get; set; }
    public decimal  Amount         { get; set; }
    public int?     LinkedSOLineId { get; set; }
    public string?  Remark         { get; set; }
}

public class CreatePurchaseOrderDto
{
    public int      MillId                { get; set; }
    public int?     MillUnitId            { get; set; }
    public string   OrderDate             { get; set; } = string.Empty;
    public string   POType                { get; set; } = "For Stock";
    public int?     LinkedSOId            { get; set; }
    public string?  DeliveryMode          { get; set; }
    public string?  ShipmentMode          { get; set; }
    public bool     BlindShipment         { get; set; }
    public string?  InvoiceParty          { get; set; }
    public int?     InvoicePartyId        { get; set; }
    public int?     DirectCustomerId      { get; set; }
    public string?  DirectDeliveryAddress { get; set; }
    // Client-requested: reveals the SO's delivery party (B) instead of
    // Customer (A) on Shipped To. Default false — same behaviour as today.
    public bool     ShowDeliveryParty     { get; set; }
    // Client-requested 2026-09-11: gates the "Customer : ..." reference line
    // on the PDF (all shipment modes, including Blind/Override). Default
    // false so Blind POs no longer leak the customer's identity by default.
    public bool     ShowCustomerName      { get; set; }
    public string?  ExpectedDeliveryDate  { get; set; }
    public string?  MillSONumber          { get; set; }
    public string?  PaymentTerms          { get; set; }
    public string?  InsurancePolicyNo     { get; set; }
    public decimal  TotalQuantity         { get; set; }
    public decimal  TotalValue            { get; set; }
    public decimal? GSTPercentage         { get; set; }
    public string?  Remarks               { get; set; }
    public string?  SpecialInstructions   { get; set; }

    // ── Backfill / backdated PO entry ────────────────────────────────────────
    // When IsBackfilled = true, the user is recording an OLD order from their
    // pre-system manual register: PONumber is supplied directly (user's
    // original format) and OrderDate carries the historical date. The auto
    // number-generation query is skipped, so the next new (non-backfilled)
    // PO keeps flowing from the same point.
    public bool     IsBackfilled          { get; set; }
    public string?  PONumber              { get; set; }   // required when IsBackfilled = true

    public List<UpsertPurchaseOrderItemDto> Items { get; set; } = [];
}

public class UpdatePurchaseOrderDto : CreatePurchaseOrderDto
{
    public string? Status { get; set; }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class PurchaseOrderFilterRequest : FilterRequest
{
    public string? Status  { get; set; }
    public int?    MillId  { get; set; }
    public string? POType  { get; set; }

    /// <summary>
    /// When true, exclude POs whose linked SO is still pending approval.
    /// Used by Approvals page so an admin can't approve a PO before its parent SO.
    /// </summary>
    public bool RequireSoApproved { get; set; }
}
