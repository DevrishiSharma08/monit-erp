using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Material : BaseEntity
{
    public string   Code             { get; set; } = string.Empty;
    public int      MillId           { get; set; }
    public int      QualityId        { get; set; }
    public int      ItemTypeId       { get; set; }
    public int      GSM              { get; set; }
    public decimal  SizeLength       { get; set; }   // cm — Reel: width; Sheet: length
    public decimal? SizeWidth        { get; set; }   // cm — null for Reel
    public string   PackingType      { get; set; } = "Sheet";  // Sheet / Packet / Bundle / Box
    public int?     SheetsPerPacket  { get; set; }
    public int?     PacketsPerBundle { get; set; }
    public int?     BundlesPerBox    { get; set; }
    public int?     HsnCodeId        { get; set; }
    public string?  Grain            { get; set; }  // Long Grain / Short Grain
    public string?  Description      { get; set; }
    public bool     IsActive         { get; set; } = true;
}
