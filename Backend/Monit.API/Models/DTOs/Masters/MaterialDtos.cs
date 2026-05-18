using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class MaterialListDto
{
    public int      Id               { get; set; }
    public string   Code             { get; set; } = string.Empty;
    public int      MillId           { get; set; }
    public string   MillCode         { get; set; } = string.Empty;
    public string   MillName         { get; set; } = string.Empty;
    public int      QualityId        { get; set; }
    public string   QualityName      { get; set; } = string.Empty;
    public int      ItemTypeId       { get; set; }
    public string   ItemTypeName     { get; set; } = string.Empty;
    public int      GSM              { get; set; }
    public decimal  SizeLength       { get; set; }
    public decimal? SizeWidth        { get; set; }
    public string   SizeLabel        { get; set; } = string.Empty;  // "72x100" or "72"
    public string   PackingType      { get; set; } = string.Empty;
    public int?     SheetsPerPacket  { get; set; }
    public int?     PacketsPerBundle { get; set; }
    public int?     BundlesPerBox    { get; set; }
    public string?  BrandName        { get; set; }  // quality alias — read-only from JOIN
    public int?     HsnCodeId        { get; set; }
    public string?  HsnCode          { get; set; }
    public decimal? GstPercent       { get; set; }
    public string?  Grain            { get; set; }
    public string?  Description      { get; set; }
    public bool     IsActive         { get; set; }
    public DateTime CreatedAt        { get; set; }
}

public class MaterialDetailDto : MaterialListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateMaterialDto
{
    public int      MillId           { get; set; }
    public int      QualityId        { get; set; }
    public int      ItemTypeId       { get; set; }
    public int      GSM              { get; set; }
    public decimal  SizeLength       { get; set; }
    public decimal? SizeWidth        { get; set; }
    public string   PackingType      { get; set; } = "Sheet";
    public int?     SheetsPerPacket  { get; set; }
    public int?     PacketsPerBundle { get; set; }
    public int?     BundlesPerBox    { get; set; }
    public int?     HsnCodeId        { get; set; }
    public string?  Grain            { get; set; }
    public string?  Description      { get; set; }
}

public class UpdateMaterialDto : CreateMaterialDto
{
    public bool IsActive { get; set; } = true;
}

public class MaterialFilterRequest : FilterRequest
{
    public int?    MillId       { get; set; }
    public int?    QualityId    { get; set; }
    public int?    ItemTypeId   { get; set; }
    public int?    GSM          { get; set; }
    public string? PackingType  { get; set; }
}

public class MaterialDropdownDto
{
    public int      Id               { get; set; }
    public string   Code             { get; set; } = string.Empty;
    public int      MillId           { get; set; }
    public string   MillName         { get; set; } = string.Empty;
    public int      QualityId        { get; set; }
    public string   QualityName      { get; set; } = string.Empty;
    public string   ItemTypeName     { get; set; } = string.Empty;
    public int      GSM              { get; set; }
    public decimal  SizeLength       { get; set; }
    public decimal? SizeWidth        { get; set; }
    public string   SizeLabel        { get; set; } = string.Empty;
    public string   PackingType      { get; set; } = string.Empty;
    public int?     SheetsPerPacket  { get; set; }
    public int?     PacketsPerBundle { get; set; }
    public int?     BundlesPerBox    { get; set; }
    public string?  BrandName        { get; set; }
    public int?     HsnCodeId        { get; set; }
    public string?  HsnCode          { get; set; }
    public decimal? GstPercent       { get; set; }
    public string?  Grain            { get; set; }
    // weight per sheet in KG: GSM × L_cm × W_cm / 10_000_000
    public decimal? WeightPerSheet   =>
        SizeWidth.HasValue && SizeWidth.Value > 0
            ? Math.Round((decimal)GSM * SizeLength * SizeWidth.Value / 10_000_000m, 6)
            : null;
}
