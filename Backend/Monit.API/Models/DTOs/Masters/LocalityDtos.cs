using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class LocalityListDto
{
    public int      Id          { get; set; }
    public string   Name        { get; set; } = string.Empty;
    public string?  City        { get; set; }
    public string?  State       { get; set; }
    public string?  Description { get; set; }
    public bool     IsActive    { get; set; }
    public DateTime CreatedAt   { get; set; }
}

public class LocalityDetailDto : LocalityListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateLocalityDto
{
    public string  Name        { get; set; } = string.Empty;
    public string? City        { get; set; }
    public string? State       { get; set; }
    public string? Description { get; set; }
}

public class UpdateLocalityDto : CreateLocalityDto
{
    public bool IsActive { get; set; } = true;
}

public class LocalityFilterRequest : FilterRequest { }

public class LocalityDropdownDto
{
    public int     Id   { get; set; }
    public string  Name { get; set; } = string.Empty;
    public string? City { get; set; }
}
