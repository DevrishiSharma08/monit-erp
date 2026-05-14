namespace Monit.API.Models.Entities.Masters;

public class StockSubGroup
{
    public int      Id           { get; set; }
    public int      StockGroupId { get; set; }
    public string   Name         { get; set; } = string.Empty;
    public string?  Alias        { get; set; }
    public bool     IsDeleted    { get; set; } = false;
    public DateTime CreatedAt    { get; set; }
    public string   CreatedBy    { get; set; } = string.Empty;
}
