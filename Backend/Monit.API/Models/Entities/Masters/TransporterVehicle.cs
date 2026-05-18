using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class TransporterVehicle : BaseEntity
{
    public int      TransporterId { get; set; }
    public string   VehicleType   { get; set; } = string.Empty;
    public decimal? Capacity      { get; set; }
    public string?  CapacityUnit  { get; set; }
    public decimal? FreightRate   { get; set; }
    public bool     IsActive      { get; set; } = true;
}
