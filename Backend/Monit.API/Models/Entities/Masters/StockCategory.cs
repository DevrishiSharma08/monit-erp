using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class StockCategory : BaseEntity
{
    public int?   StockGroupId { get; set; }
    public string Code         { get; set; } = string.Empty;
    public string Name         { get; set; } = string.Empty;
    public string GsmType      { get; set; } = "single";
    public int?   Gsm          { get; set; }
    public int?   GsmMin       { get; set; }
    public int?   GsmMax       { get; set; }
    public bool   IsActive     { get; set; } = true;
}
