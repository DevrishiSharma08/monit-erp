using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Warehouse : BaseEntity
{
    public string Unit     { get; set; } = string.Empty;
    public string Name     { get; set; } = string.Empty;
    public bool   IsActive { get; set; } = true;
}
