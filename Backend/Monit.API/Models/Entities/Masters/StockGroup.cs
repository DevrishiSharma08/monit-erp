using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class StockGroup : BaseEntity
{
    public string  Name        { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool    IsActive    { get; set; } = true;
}
