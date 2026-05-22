using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Sales;

// ─── Line DTOs ────────────────────────────────────────────────────────────────

public class SalesOrderLineDto
{
    public int      Id                   { get; set; }
    public int      LineNumber           { get; set; }
    public int      MaterialId           { get; set; }
    public string?  MaterialCode         { get; set; }
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
    public string?  ContactPerson        { get; set; }
    public string?  CustomerPhone        { get; set; }
    public string?  CustomerEmail        { get; set; }
    public string?  Salesman             { get; set; }
    public string?  DeliveryParty        { get; set; }
    public string   OrderDate            { get; set; } = string.Empty;
    public string?  RequiredDeliveryDate { get; set; }
    public string?  DeliveryPartyAddress { get; set; }
    public string   Status               { get; set; } = string.Empty;
    public string?  DeliveryMode         { get; set; }
    public string?  DeliveryTerms        { get; set; }
    public string?  PaymentTerms         { get; set; }
    public string?  Remarks              { get; set; }
    public string?  InsurancePolicyNo    { get; set; }
    public decimal  TotalValue           { get; set; }
    public string?  EmailSentAt          { get; set; }
    public List<SalesOrderLineDto> Lines { get; set; } = [];
}

// ─── Create / Update line ─────────────────────────────────────────────────────

public class UpsertSalesOrderLineDto
{
    public int     LineNumber           { get; set; }
    public int     MaterialId           { get; set; }
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
    public string?  DeliveryTerms        { get; set; }
    public string?  PaymentTerms         { get; set; }
    public string?  Remarks              { get; set; }
    public string?  InsurancePolicyNo    { get; set; }
    public List<UpsertSalesOrderLineDto> Lines { get; set; } = [];
}

// ─── Update ───────────────────────────────────────────────────────────────────

public class UpdateSalesOrderDto : CreateSalesOrderDto
{
    public string? Status { get; set; }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class SalesOrderFilterRequest : FilterRequest
{
    public string? Status     { get; set; }
    public int?    CustomerId { get; set; }
    public string? DateFrom   { get; set; }
    public string? DateTo     { get; set; }
}
