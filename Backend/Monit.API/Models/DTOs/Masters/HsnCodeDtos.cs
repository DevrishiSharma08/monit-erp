using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class HsnCodeListDto
{
    public int      Id          { get; set; }
    public string   Code        { get; set; } = string.Empty;
    public string?  Description { get; set; }
    public decimal  GstPercent  { get; set; }
    public decimal  CgstPercent => GstPercent / 2;
    public decimal  SgstPercent => GstPercent / 2;
    public decimal  IgstPercent => GstPercent;
    public bool     IsActive    { get; set; }
    public DateTime CreatedAt   { get; set; }
}

public class HsnCodeDetailDto : HsnCodeListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateHsnCodeDto
{
    public string   Code        { get; set; } = string.Empty;
    public string?  Description { get; set; }
    public decimal  GstPercent  { get; set; }
}

public class UpdateHsnCodeDto : CreateHsnCodeDto
{
    public bool IsActive { get; set; } = true;
}

public class HsnCodeFilterRequest : FilterRequest { }

public class HsnCodeDropdownDto
{
    public int     Id          { get; set; }
    public string  Code        { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal GstPercent  { get; set; }
    public decimal CgstPercent => GstPercent / 2;
    public decimal SgstPercent => GstPercent / 2;
    public decimal IgstPercent => GstPercent;
}
