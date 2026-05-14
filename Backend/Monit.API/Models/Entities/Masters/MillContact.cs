using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class MillContact : BaseEntity
{
    public int     MillUnitId    { get; set; }
    public string  ContactPerson { get; set; } = string.Empty;
    public string? Designation   { get; set; }
    public string? Phone         { get; set; }
    public string? Email         { get; set; }
    public bool    IsActive      { get; set; } = true;
}
