using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class PaperSizeListDto
{
    public int     Id        { get; set; }
    public string  Label     { get; set; } = string.Empty;
    public int?    WidthMM   { get; set; }
    public int?    HeightMM  { get; set; }
    public bool    IsCustom  { get; set; }
    public int     SortOrder { get; set; }
    public bool    IsActive  { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PaperSizeDetailDto : PaperSizeListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreatePaperSizeDto
{
    public string Label     { get; set; } = string.Empty;
    public int?   WidthMM   { get; set; }
    public int?   HeightMM  { get; set; }
    public bool   IsCustom  { get; set; } = false;
    public int    SortOrder { get; set; } = 0;
}

public class UpdatePaperSizeDto : CreatePaperSizeDto
{
    public bool IsActive { get; set; } = true;
}

public class PaperSizeFilterRequest : FilterRequest
{
    public bool? IsCustom { get; set; }
}

public class PaperSizeDropdownDto
{
    public int    Id    { get; set; }
    public string Label { get; set; } = string.Empty;
}
