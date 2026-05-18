using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Mill : BaseEntity
{
    public string  Code      { get; set; } = string.Empty;
    public string  Name      { get; set; } = string.Empty;
    public string? OwnerName     { get; set; }
    public string? Phone         { get; set; }
    public string? Email         { get; set; }
    public string? GstNo         { get; set; }
    public string? PaymentTerms  { get; set; }
    public bool    IsActive      { get; set; } = true;
}
