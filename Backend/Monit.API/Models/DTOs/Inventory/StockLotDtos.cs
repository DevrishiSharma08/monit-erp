using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Inventory;

// ─── Stock Lot list row ───────────────────────────────────────────────────────

public class StockLotRow
{
    public int      Id                { get; set; }
    public string   LotNumber         { get; set; } = string.Empty;

    // GRN link
    public int      GrnId             { get; set; }
    public string   GrnNumber         { get; set; } = string.Empty;
    public string   GrnDate           { get; set; } = string.Empty;   // FIFO key / received date

    // Material
    public int      MaterialId        { get; set; }
    public string   Paper             { get; set; } = string.Empty;
    public int?     Gsm               { get; set; }
    public string?  Size              { get; set; }

    // Mill
    public int      MillId            { get; set; }
    public string   MillName          { get; set; } = string.Empty;

    // Location
    public int?     WarehouseId       { get; set; }
    public string?  WarehouseName     { get; set; }
    public string?  BinLocation       { get; set; }  // bin code e.g. Lasudia-A-1-A1

    // Quantities
    public decimal  OpeningQty        { get; set; }
    public decimal  CurrentQty        { get; set; }
    public decimal  AllocatedQty      { get; set; }  // ReservedQty in DB
    public decimal  AvailableQty      { get; set; }  // computed persisted: CurrentQty - ReservedQty

    // Cost
    public decimal? CostPerUnit       { get; set; }
    public decimal? TotalCost         { get; set; }

    // Quality / Status
    public string?  Condition         { get; set; }
    public string?  QualityGrade      { get; set; }
    public string   Status            { get; set; } = "Available";
    public int      FifoSequence      { get; set; }

    // Chain context (JOINed — no extra API calls needed)
    public int      PoId              { get; set; }
    public string   PoNumber          { get; set; } = string.Empty;
    public int?     LoadPlanId        { get; set; }
    public string?  LoadPlanNumber    { get; set; }
    public int?     LinkedSoId        { get; set; }
    public string?  LinkedSoNumber    { get; set; }
    public string?  CustomerName      { get; set; }  // effective real client

    // Audit
    public string   CreatedBy         { get; set; } = string.Empty;
    public DateTime CreatedAt         { get; set; }
}

// ─── Stock Lot detail (full chain for View modal) ─────────────────────────────

public class StockLotDetailRow : StockLotRow
{
    // GRN transport details
    public string?  GrnQcResult       { get; set; }
    public string?  GrnVehicleNumber  { get; set; }
    public string?  GrnLrNumber       { get; set; }
    public string?  GrnCondition      { get; set; }

    // TLP details
    public string?  TlpTruckNumber    { get; set; }
    public string?  TlpTransporter    { get; set; }
    public string?  TlpDate           { get; set; }
    public string?  TlpOrigin         { get; set; }
    public string?  TlpStatus         { get; set; }

    // SO / Customer
    public string?  SoDate            { get; set; }
    public string?  SoCustomerName    { get; set; }

    // PO
    public string?  PoDate            { get; set; }
    public decimal? PoRate            { get; set; }

    // PO billing mode (for display in view)
    public string   BillingMode       { get; set; } = "Normal";
    public string?  EffectiveClientName { get; set; }
}

// ─── Update (bin assignment / qty adjustment) ─────────────────────────────────

public class UpdateStockLotDto
{
    public decimal? CurrentQty    { get; set; }   // physical-count adjustment
    public int?     WarehouseId   { get; set; }
    public int?     BinLocationId { get; set; }
    public string?  QualityGrade  { get; set; }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class StockLotFilterRequest : FilterRequest
{
    public string? Status      { get; set; }
    public string? WarehouseId { get; set; }
    public string? MaterialId  { get; set; }
    public string? MillId      { get; set; }
    public bool    NoBin       { get; set; }   // true → only lots without bin assignment
}
