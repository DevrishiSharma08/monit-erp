namespace Monit.API.Models.Entities.Sales;

public class SalesOrder
{
    public int      Id                   { get; set; }
    public string   SONumber             { get; set; } = string.Empty;
    public int      CustomerId           { get; set; }
    public int?     ContactPersonId      { get; set; }
    public string?  ContactPerson        { get; set; }
    public int?     SalesmanId           { get; set; }
    public string?  SalesmanName         { get; set; }
    public int?     DeliveryPartyId      { get; set; }
    public DateTime OrderDate            { get; set; }
    public DateTime? RequiredDeliveryDate { get; set; }
    public string   Status               { get; set; } = "Approval Pending";
    public string?  PaymentTerms         { get; set; }
    public string?  DeliveryTerms        { get; set; }
    public string?  DeliveryMode         { get; set; }
    public decimal  TotalValue           { get; set; }
    public string?  Remarks              { get; set; }
    public string?  InsurancePolicyNo    { get; set; }
    public int?     InquiryId            { get; set; }
    public string?  InvoiceNumber        { get; set; }

    public DateTime  CreatedAt  { get; set; }
    public string    CreatedBy  { get; set; } = string.Empty;
    public DateTime? UpdatedAt  { get; set; }
    public string?   UpdatedBy  { get; set; }
    public bool      IsDeleted  { get; set; }
    public DateTime? DeletedAt  { get; set; }
    public string?   DeletedBy  { get; set; }
}
