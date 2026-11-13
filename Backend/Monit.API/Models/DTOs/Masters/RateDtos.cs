using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class RateListDto
{
    public int      Id           { get; set; }
    public int      MQGId        { get; set; }
    public string?  BrandName    { get; set; }
    public string   MQGCode      { get; set; } = string.Empty;
    public string   MQGLabel     { get; set; } = string.Empty;
    public int      MillId       { get; set; }
    public string   MillCode     { get; set; } = string.Empty;
    public string   MillName     { get; set; } = string.Empty;
    public int?     MillUnitId   { get; set; }
    public string?  MillUnitName { get; set; }
    public int      QualityId    { get; set; }
    public string   QualityName  { get; set; } = string.Empty;
    public int      GsmMin       { get; set; }
    public int      GsmMax       { get; set; }
    public string   Type         { get; set; } = string.Empty;   // Reel / Sheet
    public string   RateType     { get; set; } = string.Empty;   // Sale / Purchase
    public string?  RateCategory { get; set; }                   // null | Self | Customer
    public int?     CustomerId   { get; set; }
    public string?  CustomerName { get; set; }
    public decimal  Amount       { get; set; }
    public decimal? Discount     { get; set; }                   // ₹/KG optional discount
    public string   EffectiveFrom { get; set; } = string.Empty;  // ISO date string (yyyy-MM-dd)
    public bool     IsActive     { get; set; }
    public DateTime CreatedAt    { get; set; }
}

// Used by SO form to auto-fill rates when customer is selected
public class SORateDto
{
    public int     MaterialId { get; set; }
    public decimal Rate       { get; set; }
    public decimal Discount   { get; set; }
}

// "Last order" rate fallback (below Rate Master) — keyed by Mill/Quality/GSM,
// same dimensions Rate Master itself prices by, NOT by exact Material/Size.
// Client-requested: if Mill+Quality+GSM match a past order, reuse that rate
// regardless of the new item's Size.
public class LastRateDto
{
    public int     MillId    { get; set; }
    public int     QualityId { get; set; }
    public int     Gsm       { get; set; }
    public decimal Rate      { get; set; }
    public decimal Discount  { get; set; }
}

public class RateHistoryDto
{
    public int      Id            { get; set; }
    public decimal  Amount        { get; set; }
    public string   EffectiveFrom { get; set; } = string.Empty;
    public DateTime CreatedAt     { get; set; }
    public string   CreatedBy     { get; set; } = string.Empty;
}

public class CreateSaleRateDto
{
    public int          MillId        { get; set; }
    public int          QualityId     { get; set; }
    public int          GsmMin        { get; set; }
    public int          GsmMax        { get; set; }
    public string       Type          { get; set; } = string.Empty;  // Reel / Sheet
    public List<int>?   CustomerIds   { get; set; }
    public decimal      Amount        { get; set; }
    public decimal?     Discount      { get; set; }
    public DateOnly     EffectiveFrom { get; set; }
}

// One per-unit rate entry inside CreatePurchaseRateDto. Each entry becomes
// its own Rate row keyed by MillUnitId so a single mill can have different
// purchase rates per unit (the most common business case).
public class PurchaseUnitRateEntry
{
    public int?     MillUnitId { get; set; }   // null => mill-wide rate
    public decimal  Amount     { get; set; }
    public decimal? Discount   { get; set; }
}

public class CreatePurchaseRateDto
{
    public int          MillId        { get; set; }
    public int          QualityId     { get; set; }
    public int          GsmMin        { get; set; }
    public int          GsmMax        { get; set; }
    public string       Type          { get; set; } = string.Empty;
    public string       RateCategory  { get; set; } = string.Empty;  // Self / Customer
    public List<int>?   CustomerIds   { get; set; }
    // Per-unit rate entries. If provided AND non-empty, one Rate row is
    // created per entry (per customer if Customer category). When null/empty
    // the legacy Amount/Discount fields below are used as a single mill-wide
    // rate (back-compat for callers that don't yet know about units).
    public List<PurchaseUnitRateEntry>? UnitRates { get; set; }
    public decimal      Amount        { get; set; }
    public decimal?     Discount      { get; set; }
    public DateOnly     EffectiveFrom { get; set; }
}

public class RateFilterRequest : FilterRequest
{
    public string? RateType     { get; set; }   // Sale / Purchase
    public int?    MillId       { get; set; }
    public int?    MQGId        { get; set; }
    public int?    CustomerId   { get; set; }
    public string? RateCategory { get; set; }
    public new bool? IsActive   { get; set; }
}
