using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class MillUnit : BaseEntity
{
    public int     MillId   { get; set; }
    public string  UnitName { get; set; } = string.Empty;
    public string? Address  { get; set; }
    public bool    IsActive { get; set; } = true;
}
