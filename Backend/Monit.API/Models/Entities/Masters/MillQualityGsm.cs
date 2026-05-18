using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class MillQualityGsm : BaseEntity
{
    public string Code      { get; set; } = string.Empty;
    public int    MillId    { get; set; }
    public int    QualityId { get; set; }
    public int    GsmMin    { get; set; }
    public int    GsmMax    { get; set; }
    public string Type      { get; set; } = string.Empty; // Reel / Sheet
    public bool   IsActive  { get; set; } = true;
}
