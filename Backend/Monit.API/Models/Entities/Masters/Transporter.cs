using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Transporter : BaseEntity
{
    public string   Name       { get; set; } = string.Empty;
    public string?  Phone      { get; set; }
    public string?  Email      { get; set; }
    public string?  Address    { get; set; }
    public string?  GstNo      { get; set; }
    public string?  PanNo      { get; set; }
    public decimal? TdsPercent { get; set; }
    public bool     IsActive   { get; set; } = true;
}
