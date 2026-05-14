namespace Monit.API.Models.Entities.Sales;

public class SalesOrderLine
{
    public int      Id              { get; set; }
    public int      SOId            { get; set; }
    public int      LineNumber      { get; set; }
    public int      MaterialId      { get; set; }
    public string?  Description     { get; set; }   // materialCode — denormalized
    public int?     GSM             { get; set; }
    public string?  Size            { get; set; }
    public string?  Unit            { get; set; }
    public decimal  Quantity        { get; set; }   // orderedQty / weightKg
    public int?     Qty             { get; set; }   // sheet count (optional)
    public decimal  Rate            { get; set; }
    public decimal  Discount        { get; set; }
    public decimal? FinalPrice      { get; set; }
    public decimal  Amount          { get; set; }
    public DateTime? DeliveryDate   { get; set; }   // requiredDeliveryDate
    public string?  DeliveryAddress { get; set; }
    public string   LineStatus      { get; set; } = "Pending Allocation";
    public decimal  AllocatedQty    { get; set; }
    public decimal  PendingQty      { get; set; }

    public DateTime  CreatedAt  { get; set; }
    public string    CreatedBy  { get; set; } = string.Empty;
    public DateTime? UpdatedAt  { get; set; }
    public string?   UpdatedBy  { get; set; }
    public bool      IsDeleted  { get; set; }
    public DateTime? DeletedAt  { get; set; }
    public string?   DeletedBy  { get; set; }
}
