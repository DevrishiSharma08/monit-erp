using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Locality : BaseEntity
{
    public string  Name        { get; set; } = string.Empty;
    public string? City        { get; set; }
    public string? State       { get; set; }
    public string? Description { get; set; }
    public bool    IsActive    { get; set; } = true;
}
