using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class CustomerContact : BaseEntity
{
    public int     CustomerId   { get; set; }
    public string  Name         { get; set; } = string.Empty;
    public string? Designation  { get; set; }
    public string? Phone        { get; set; }
    public string? Email        { get; set; }
    public bool    IsDefault    { get; set; }
}
