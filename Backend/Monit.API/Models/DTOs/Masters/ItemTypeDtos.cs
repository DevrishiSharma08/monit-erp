using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class ItemTypeListDto
{
    public int     Id          { get; set; }
    public string  Code        { get; set; } = string.Empty;
    public string  Name        { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool    IsActive    { get; set; }
    public DateTime CreatedAt  { get; set; }
}

public class ItemTypeDetailDto : ItemTypeListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateItemTypeDto
{
    public string  Code        { get; set; } = string.Empty;
    public string  Name        { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateItemTypeDto : CreateItemTypeDto
{
    public bool IsActive { get; set; } = true;
}

public class ItemTypeFilterRequest : FilterRequest { }

public class ItemTypeDropdownDto
{
    public int    Id   { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
