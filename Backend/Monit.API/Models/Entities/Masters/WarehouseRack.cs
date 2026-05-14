using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class WarehouseRack : BaseEntity
{
    public int    BinId      { get; set; }
    public string Name       { get; set; } = string.Empty;
    public int    StackCount { get; set; } = 1;
    public bool   IsActive   { get; set; } = true;
}
