using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class PaperSize : BaseEntity
{
    public string Label     { get; set; } = string.Empty;  // "23x36", "A4"
    public int?   WidthMM   { get; set; }
    public int?   HeightMM  { get; set; }
    public bool   IsCustom  { get; set; } = false;
    public int    SortOrder { get; set; } = 0;
    public bool   IsActive  { get; set; } = true;
}
