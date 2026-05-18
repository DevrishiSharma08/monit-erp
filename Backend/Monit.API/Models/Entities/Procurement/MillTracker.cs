using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Procurement;

public class MillTracker : BaseEntity
{
    public int       PoId               { get; set; }
    public int?      PoItemId           { get; set; }
    public int       MillId             { get; set; }
    public DateOnly? PoDate             { get; set; }
    public int?      MaterialId         { get; set; }
    public string?   PoNumber           { get; set; }
    public string?   Description        { get; set; }
    public int?      Gsm                { get; set; }
    public string?   Size               { get; set; }
    public string?   SoNumber           { get; set; }
    public DateOnly? SoDeliveryDate     { get; set; }
    public int?      SoCustomerId       { get; set; }
    public decimal   OrderedQty         { get; set; } = 0;
    public decimal   ReadyQty           { get; set; } = 0;
    public decimal   DispatchedQty      { get; set; } = 0;
    // BalanceQty: PERSISTED computed column — not settable
    public decimal?  Rate               { get; set; }
    public decimal?  TotalAmount        { get; set; }
    public string    ProductionStatus   { get; set; } = "Order Placed";
    public decimal   ProductionProgress { get; set; } = 0;
    public DateOnly? ExpectedDelivery   { get; set; }
    public DateOnly? ActualDispatchDate { get; set; }
    public DateTime? LastUpdate         { get; set; }
    public string?   LastUpdatedBy      { get; set; }
    // DelayDays: non-persisted computed column — not settable
    public int?      LinkedSOId         { get; set; }
    public string?   DeliveryMode       { get; set; }
    public string?   MillInvoiceNo      { get; set; }
    public string?   CustomerName       { get; set; }
    public int?      CustomerId         { get; set; }
    public string?   Remarks            { get; set; }
}
