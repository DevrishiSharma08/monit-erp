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
    public int?     Gsm                { get; set; }
    public string?  Size               { get; set; }
    public decimal  OrderedQty         { get; set; }
    public decimal  ReadyQty           { get; set; }
    public decimal  DispatchedQty      { get; set; }
    public decimal  BalanceQty         { get; set; }
    public decimal  Rate               { get; set; }
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
    public int          Updated { get; set; }
    public int          Skipped { get; set; }
    public List<string> Errors  { get; set; } = [];
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
}
