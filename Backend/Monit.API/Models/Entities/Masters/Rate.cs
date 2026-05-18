using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Rate : BaseEntity
{
    public int      MQGId         { get; set; }
    public string   RateType      { get; set; } = string.Empty;  // Sale / Purchase
    public string?  RateCategory  { get; set; }                  // null for Sale | Self / Customer for Purchase
    public int?     CustomerId    { get; set; }
    public decimal  Amount        { get; set; }                  // maps to column [Rate]
    public decimal? Discount      { get; set; }                  // ₹/KG discount
    public DateOnly EffectiveFrom { get; set; }
    public bool     IsActive      { get; set; } = true;
}
