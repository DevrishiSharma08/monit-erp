using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Customer : BaseEntity
{
    public string  Name           { get; set; } = string.Empty;
    public string? OwnerName      { get; set; }
    public string? Phone          { get; set; }
    public string? Email          { get; set; }
    public string? GSTNo          { get; set; }
    public string? BillingAddress { get; set; }
    public decimal CreditLimit    { get; set; } = 0;
    public int     CreditDays     { get; set; } = 0;
    public string? PaymentTerms   { get; set; }
    public int?    LocalityId     { get; set; }
    public bool    IsActive       { get; set; } = true;
}
