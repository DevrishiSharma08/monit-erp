using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class CustomerDeliveryLocation : BaseEntity
{
    public int     CustomerId { get; set; }
    public string? Label      { get; set; }
    public string  Address    { get; set; } = string.Empty;
    public bool    IsDefault  { get; set; } = false;
}
