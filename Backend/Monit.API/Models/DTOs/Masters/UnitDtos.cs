using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class UnitListDto
{
    public int      Id          { get; set; }
    public string   Name        { get; set; } = string.Empty;
    public string?  Description { get; set; }
    public bool     IsActive    { get; set; }
    public DateTime CreatedAt   { get; set; }
}

public class UnitDetailDto : UnitListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateUnitDto
{
    public string  Name        { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateUnitDto : CreateUnitDto
{
    public bool IsActive { get; set; } = true;
}

public class UnitFilterRequest : FilterRequest { }

public class UnitDropdownDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}
