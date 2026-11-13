using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Sales;

// ─── Line DTOs ────────────────────────────────────────────────────────────────

public class SalesOrderLineDto
{
    public int      Id                   { get; set; }
    public int      LineNumber           { get; set; }
    public int?     MaterialId           { get; set; }   // null = free-text custom item code
    public string?  MaterialCode         { get; set; }
    public string?  BrandName            { get; set; }   // for ShowBrandInItemCode re-composition
    public int?     Gsm                  { get; set; }
    public string?  Size                 { get; set; }
    public string?  Unit                 { get; set; }
    public decimal  OrderedQty           { get; set; }
    public int?     Qty                  { get; set; }
    public decimal  Rate                 { get; set; }
    public decimal  Discount             { get; set; }
    public decimal  FinalPrice           { get; set; }
    public decimal  Amount               { get; set; }
    public string?  DeliveryAddress      { get; set; }
    public string?  RequiredDeliveryDate { get; set; }
    public string?  Remarks              { get; set; }
    public string   Status               { get; set; } = "Pending Allocation";
    public decimal  AllocatedQty         { get; set; }
    public decimal  PendingQty           { get; set; }
}

// ─── List DTO (grid + KPIs + view modal) ─────────────────────────────────────

public class SalesOrderListDto
{
    public int      Id                   { get; set; }
    public string   SONumber             { get; set; } = string.Empty;
    public int      CustomerId           { get; set; }
    public int?     ContactPersonId      { get; set; }
    public int?     SalesmanId           { get; set; }
    public int?     DeliveryPartyId      { get; set; }
    public string   Customer             { get; set; } = string.Empty;
    // From masters.Customers — surfaced on the SO PDF "Billed To" / "Shipped
    // To" cells (customer name, billing address, GST).
    public string?  CustomerGstNo        { get; set; }
    public string?  CustomerAddress      { get; set; }
    public string?  ContactPerson        { get; set; }
    public string?  CustomerPhone        { get; set; }
    public string?  CustomerEmail        { get; set; }
    public string?  Salesman             { get; set; }
    public string?  DeliveryParty        { get; set; }
    public string?  DeliveryPartyGstNo   { get; set; }   // GSTNo of the delivery-party customer (when set)
    public string   OrderDate            { get; set; } = string.Empty;
    public string?  RequiredDeliveryDate { get; set; }
    public string?  DeliveryPartyAddress { get; set; }
    public string   Status               { get; set; } = string.Empty;
    public string?  DeliveryMode         { get; set; }
    public string?  PaymentTerms         { get; set; }
    public string?  Remarks              { get; set; }
    public string?  InsurancePolicyNo    { get; set; }
    public decimal  TotalValue           { get; set; }
    public bool     ShowBrandInItemCode  { get; set; }   // ad-hoc display flag (default false)
    public bool     IsBackfilled         { get; set; }   // historical / pre-system entry
    public string?  CancelReason         { get; set; }
    public string?  CancelledAt          { get; set; }
    public string?  CancelledBy          { get; set; }
    public string?  EmailSentAt          { get; set; }
    public int      LinkedPoCount        { get; set; }
    public List<SalesOrderLineDto> Lines { get; set; } = [];
}

// ─── Create / Update line ─────────────────────────────────────────────────────

public class UpsertSalesOrderLineDto
{
    // Present (matches an existing sales.SalesOrderLines.Id) when editing an
    // existing line — lets the repository UPDATE it in place instead of
    // soft-deleting + reinserting under a new Id. Null/0 for a brand-new
    // line the user just added in this edit.
    public int?    Id                   { get; set; }
    public int     LineNumber           { get; set; }
    public int?    MaterialId           { get; set; }   // null = free-text custom item code
    public string? MaterialCode         { get; set; }
    public int?    Gsm                  { get; set; }
    public string? Size                 { get; set; }
    public string? Unit                 { get; set; }
    public decimal OrderedQty           { get; set; }
    public int?    Qty                  { get; set; }
    public decimal Rate                 { get; set; }
    public decimal Discount             { get; set; }
    public decimal FinalPrice           { get; set; }
    public decimal Amount               { get; set; }
    public string? DeliveryAddress      { get; set; }
    public string? RequiredDeliveryDate { get; set; }
    public string? Remarks              { get; set; }
}

// ─── Create ───────────────────────────────────────────────────────────────────

public class CreateSalesOrderDto
{
    public int      CustomerId           { get; set; }
    public int?     ContactPersonId      { get; set; }
    public string?  SalesmanName         { get; set; }
    public string   OrderDate            { get; set; } = string.Empty;
    public string?  RequiredDeliveryDate { get; set; }
    public int?     DeliveryPartyId      { get; set; }
    public string?  DeliveryPartyAddress { get; set; }
    public string?  DeliveryMode         { get; set; }
    public string?  PaymentTerms         { get; set; }
    public string?  Remarks              { get; set; }
    public string?  InsurancePolicyNo    { get; set; }
    public bool     ShowBrandInItemCode  { get; set; }   // default false

    // ── Backfill / backdated SO entry ────────────────────────────────────────
    // When IsBackfilled = true, the user is recording an OLD order from their
    // pre-system manual register: SONumber is supplied directly (user's
    // original format) and OrderDate carries the historical date. The auto
    // number-sequence counter is NOT touched, so the next new (non-backfilled)
    // SO keeps flowing from the same point.
    public bool     IsBackfilled         { get; set; }
    public string?  SONumber             { get; set; }   // required when IsBackfilled = true

    public List<UpsertSalesOrderLineDto> Lines { get; set; } = [];
}

// ─── Update ───────────────────────────────────────────────────────────────────

public class UpdateSalesOrderDto : CreateSalesOrderDto
{
    public string? Status { get; set; }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

public class CancelSalesOrderDto
{
    public string Reason { get; set; } = string.Empty;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class SalesOrderFilterRequest : FilterRequest
{
    public string? Status     { get; set; }
    public int?    CustomerId { get; set; }
    public string? DateFrom   { get; set; }
    public string? DateTo     { get; set; }
}
