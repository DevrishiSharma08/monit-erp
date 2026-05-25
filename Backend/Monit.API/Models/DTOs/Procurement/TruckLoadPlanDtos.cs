using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Procurement;

// ─── Load DTO (one per named load within a plan) ──────────────────────────────

public class TruckLoadPlanLoadDto
{
    public int      Id           { get; set; }
    public int      PlanId       { get; set; }
    public string   LoadType     { get; set; } = string.Empty;  // "Load 1" | "Load 2" | "Load 3" | "Last Load"
    public int      LoadSequence { get; set; }
    public string?  Address      { get; set; }
    public List<TruckLoadPlanItemDto> Items { get; set; } = [];
}

// ─── Item DTO (used in both list and detail) ──────────────────────────────────

public class TruckLoadPlanItemDto
{
    public int      Id               { get; set; }
    public int      PlanId           { get; set; }
    public int?     LoadId           { get; set; }
    public string?  LoadType         { get; set; }
    public int?     TrackerId        { get; set; }
    public string?  PoNumber         { get; set; }
    public string?  SoNumber         { get; set; }
    public string?  Paper            { get; set; }
    public int?     Gsm              { get; set; }
    public string?  Size             { get; set; }
    public string?  CustomerName     { get; set; }
    public string?  Mill             { get; set; }
    public decimal  Quantity         { get; set; }
    public decimal? PlanQty          { get; set; }
    public decimal? WeightKg         { get; set; }
    public int      LoadOrder        { get; set; }
    public string?  DeliveryLocation { get; set; }
    public string?  DeliveryAddress  { get; set; }
    public string?  MillInvoiceNo    { get; set; }
    public string?  DeliveryBillNo   { get; set; }
    public string   ShipmentMode     { get; set; } = "Normal";
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

    public List<TruckLoadPlanLoadDto>  Loads { get; set; } = [];
    public List<TruckLoadPlanItemDto>  Items { get; set; } = [];  // flat list, kept for compat
}

// ─── Create DTOs ──────────────────────────────────────────────────────────────

public class CreateLoadDto
{
    public string  LoadType     { get; set; } = string.Empty;
    public int     LoadSequence { get; set; }
    public string? Address      { get; set; }
}

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
    public decimal? PlanQty          { get; set; }
    public decimal? WeightKg         { get; set; }
    public int      LoadOrder        { get; set; } = 1;
    public string?  LoadType         { get; set; }   // matched to Loads list on save
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

    public List<CreateLoadDto>              Loads { get; set; } = [];
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
