using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Procurement;

public class PurchaseOrder : BaseEntity
{
    public string   PONumber               { get; set; } = string.Empty;
    public int      MillId                 { get; set; }
    public DateOnly OrderDate              { get; set; }
    public string   POType                 { get; set; } = "For Stock";
    public int?     LinkedSOId             { get; set; }
    public string?  DeliveryMode           { get; set; }
    public string   ShipmentMode           { get; set; } = "Normal";
    public bool     BlindShipment          { get; set; } = false;
    public string?  InvoiceParty           { get; set; }
    public int?     InvoicePartyId         { get; set; }
    public int?     DirectCustomerId       { get; set; }
    public string?  DirectDeliveryAddress  { get; set; }
    public DateOnly? ExpectedDeliveryDate  { get; set; }
    public string?  MillSONumber           { get; set; }
    public string?  PaymentTerms           { get; set; }
    public decimal  TotalQuantity          { get; set; } = 0;
    public decimal  TotalValue             { get; set; } = 0;
    public string   Status                 { get; set; } = "Approval Pending";
    public decimal? GSTPercentage          { get; set; }
    public string?  Remarks                { get; set; }
    public string?  SpecialInstructions    { get; set; }
}
