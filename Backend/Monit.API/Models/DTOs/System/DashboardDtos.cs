namespace Monit.API.Models.DTOs.Dashboard;

public class DashboardSummaryDto
{
    public int    OpenSoCount        { get; set; }
    public decimal OpenSoValue       { get; set; }
    public int    OpenPoCount        { get; set; }
    public decimal OpenPoValue       { get; set; }
    public int    PendingGrnCount    { get; set; }
    public int    AvailableStockLots { get; set; }
    public decimal AvailableStockQty { get; set; }
    public int    MillTrackerTotal   { get; set; }
    public int    MillTrackerReady   { get; set; }

    public List<DashboardOrderRow>       RecentSalesOrders    { get; set; } = [];
    public List<DashboardOrderRow>       RecentPurchaseOrders { get; set; } = [];
    public List<DashboardMillTrackerRow> MillTrackers         { get; set; } = [];
    public List<DashboardStatusItem>     SoStatusBreakdown    { get; set; } = [];
    public List<DashboardStatusItem>     PoStatusBreakdown    { get; set; } = [];
}

public class DashboardOrderRow
{
    public int     Id          { get; set; }
    public string  Number      { get; set; } = string.Empty;
    public string  Party       { get; set; } = string.Empty;
    public string  Status      { get; set; } = string.Empty;
    public decimal TotalValue  { get; set; }
    public string  OrderDate   { get; set; } = string.Empty;
}

public class DashboardMillTrackerRow
{
    public int     Id                 { get; set; }
    public string  Material           { get; set; } = string.Empty;
    public string  Mill               { get; set; } = string.Empty;
    public decimal OrderedQty         { get; set; }
    public string  ProductionStatus   { get; set; } = string.Empty;
    public int     ProductionProgress { get; set; }
}

public class DashboardStatusItem
{
    public string Name  { get; set; } = string.Empty;
    public int    Value { get; set; }
}
