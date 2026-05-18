using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Salesman : BaseEntity
{
    public string  Code      { get; set; } = string.Empty;
    public string  Name      { get; set; } = string.Empty;
    public string? Phone     { get; set; }
    public string? Email     { get; set; }
    public string? Territory { get; set; }
    public int?    UserId    { get; set; }
    public bool    IsActive  { get; set; } = true;
}
