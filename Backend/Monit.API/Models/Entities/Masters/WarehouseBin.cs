using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class WarehouseBin : BaseEntity
{
    public int    WarehouseId { get; set; }
    public string Name        { get; set; } = string.Empty;
    public bool   IsActive    { get; set; } = true;
}
