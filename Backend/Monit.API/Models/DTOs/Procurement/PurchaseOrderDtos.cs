using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Procurement;

// ─── Item DTO ─────────────────────────────────────────────────────────────────

public class PurchaseOrderItemDto
{
    public int      Id             { get; set; }
    public int      LineNumber     { get; set; }
    public int      MaterialId     { get; set; }
    public string?  Description    { get; set; }
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
    public int?     MillUnitId            { get; set; }
    public string?  MillUnitName          { get; set; }
    public string   OrderDate             { get; set; } = string.Empty;
    public string   POType                { get; set; } = string.Empty;
    public int?     LinkedSOId            { get; set; }
    public string?  LinkedSONumber        { get; set; }
    public string?  DeliveryMode          { get; set; }
    public string?  ShipmentMode          { get; set; }
    public bool     BlindShipment         { get; set; }
    public string?  InvoiceParty          { get; set; }
    public int?     InvoicePartyId        { get; set; }
    public int?     DirectCustomerId      { get; set; }
    public string?  DirectCustomer        { get; set; }
    public string?  DirectDeliveryAddress { get; set; }
    public string?  ExpectedDeliveryDate  { get; set; }
    public string?  MillSONumber          { get; set; }
    public string?  PaymentTerms          { get; set; }
    public decimal  TotalQuantity         { get; set; }
    public decimal  TotalValue            { get; set; }
    public string   Status                { get; set; } = string.Empty;
    public decimal? GSTPercentage         { get; set; }
    public string?  Remarks               { get; set; }
    public string?  SpecialInstructions   { get; set; }
    public DateTime CreatedAt             { get; set; }
    public string?  EmailSentAt           { get; set; }
    public List<PurchaseOrderItemDto> Items { get; set; } = [];
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

public class UpsertPurchaseOrderItemDto
{
    public int      LineNumber     { get; set; }
    public int      MaterialId     { get; set; }
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
    public string?  ExpectedDeliveryDate  { get; set; }
    public string?  MillSONumber          { get; set; }
    public string?  PaymentTerms          { get; set; }
    public decimal  TotalQuantity         { get; set; }
    public decimal  TotalValue            { get; set; }
    public decimal? GSTPercentage         { get; set; }
    public string?  Remarks               { get; set; }
    public string?  SpecialInstructions   { get; set; }
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
}
