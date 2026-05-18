using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Procurement;

public class PurchaseOrderItem : BaseEntity
{
    public int      POId           { get; set; }
    public int      LineNumber     { get; set; }
    public int      MaterialId     { get; set; }
    public string?  Description    { get; set; }
    public int?     GSM            { get; set; }
    public string?  Size           { get; set; }
    public decimal  Quantity       { get; set; }
    public decimal? WeightKg       { get; set; }
    public string?  Unit           { get; set; } = "Sheet";
    public decimal? Rate           { get; set; }
    public decimal? Discount       { get; set; }
    public decimal? Amount         { get; set; }
    public decimal  ReceivedQty    { get; set; } = 0;
    public decimal  PendingQty     { get; set; } = 0;
    public int?     LinkedSOLineId { get; set; }
    public string?  Remark         { get; set; }
}
