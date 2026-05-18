using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Procurement;

// ─── Item DTO (used in both list and detail) ──────────────────────────────────

public class TruckLoadPlanItemDto
{
    public int      Id               { get; set; }
    public int      PlanId           { get; set; }
    public int?     TrackerId        { get; set; }
    public string?  PoNumber         { get; set; }
    public string?  SoNumber         { get; set; }
    public string?  Paper            { get; set; }
    public int?     Gsm              { get; set; }
    public string?  Size             { get; set; }
    public string?  CustomerName     { get; set; }
    public string?  Mill             { get; set; }
    public decimal  Quantity         { get; set; }
    public decimal? WeightKg         { get; set; }
    public int      LoadOrder        { get; set; }
    public string?  DeliveryLocation { get; set; }
    public string?  DeliveryAddress  { get; set; }
    public string?  MillInvoiceNo    { get; set; }
    public string?  DeliveryBillNo   { get; set; }
}

// ─── Plan DTO ─────────────────────────────────────────────────────────────────

public class TruckLoadPlanDto
{
    public int      Id                  { get; set; }
    public string   PlanNumber          { get; set; } = string.Empty;
    public string   PlanDate            { get; set; } = string.Empty;
    public string?  TruckNumber         { get; set; }
    public string?  TruckType           { get; set; }
    public string?  TransporterName     { get; set; }
    public string?  DriverName          { get; set; }
    public string?  DriverPhone         { get; set; }
    public decimal? TruckCapacityKg     { get; set; }
    public decimal? FreightAmount       { get; set; }
    public string?  Origin              { get; set; }
    public string   DeliveryMode        { get; set; } = "Direct To Customer";
    public string?  MillInvoiceNo       { get; set; }
    public string?  DeliveryBillNo      { get; set; }
    public string?  PlannedLoadDate     { get; set; }
    public string?  PlannedDeliveryDate { get; set; }
    public string?  ActualLoadDate      { get; set; }
    public string?  ActualDeliveryDate  { get; set; }
    public string   Status              { get; set; } = "Planned";
    public string?  Remarks             { get; set; }
    public DateTime CreatedAt           { get; set; }

    public List<TruckLoadPlanItemDto> Items { get; set; } = [];
}

// ─── Create DTOs ──────────────────────────────────────────────────────────────

public class CreateTruckLoadPlanItemDto
{
    public int?     TrackerId        { get; set; }
    public string?  PoNumber         { get; set; }
    public string?  SoNumber         { get; set; }
    public string?  Paper            { get; set; }
    public int?     Gsm              { get; set; }
    public string?  Size             { get; set; }
    public string?  CustomerName     { get; set; }
    public string?  Mill             { get; set; }
    public decimal  Quantity         { get; set; }
    public decimal? WeightKg         { get; set; }
    public int      LoadOrder        { get; set; } = 1;
    public string?  DeliveryLocation { get; set; }
    public string?  DeliveryAddress  { get; set; }
    public string?  MillInvoiceNo    { get; set; }
    public string?  DeliveryBillNo   { get; set; }
}

public class CreateTruckLoadPlanDto
{
    public string?  TruckNumber         { get; set; }
    public string?  TruckType           { get; set; }
    public string?  TransporterName     { get; set; }
    public string?  DriverName          { get; set; }
    public string?  DriverPhone         { get; set; }
    public decimal? TruckCapacityKg     { get; set; }
    public decimal? FreightAmount       { get; set; }
    public string?  Origin              { get; set; }
    public string   DeliveryMode        { get; set; } = "Direct To Customer";
    public string?  MillInvoiceNo       { get; set; }
    public string?  DeliveryBillNo      { get; set; }
    public string?  PlannedLoadDate     { get; set; }
    public string?  PlannedDeliveryDate { get; set; }
    public string?  Remarks             { get; set; }

    public List<CreateTruckLoadPlanItemDto> Items { get; set; } = [];
}

// ─── Status update DTO ────────────────────────────────────────────────────────

public class UpdateTruckLoadPlanStatusDto
{
    public string  Status             { get; set; } = string.Empty;
    public string? ActualLoadDate     { get; set; }
    public string? ActualDeliveryDate { get; set; }
    public string? Remarks            { get; set; }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class TruckLoadPlanFilterRequest : FilterRequest
{
    public string? Status      { get; set; }
    public string? TruckNumber { get; set; }
    public string? MillId      { get; set; }
}
