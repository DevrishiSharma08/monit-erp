using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Auth;

public class RoleListDto
{
    public int     Id          { get; set; }
    public string  Name        { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool    IsActive    { get; set; }
    public int     UserCount   { get; set; }
    public DateTime CreatedAt  { get; set; }
}

public class RoleDetailDto : RoleListDto
{
    public List<string> Permissions { get; set; } = [];
    public DateTime?    UpdatedAt   { get; set; }
    public string?      UpdatedBy   { get; set; }
}

public class CreateRoleDto
{
    public string        Name        { get; set; } = string.Empty;
    public string?       Description { get; set; }
    public List<string>  Permissions { get; set; } = [];
}

public class UpdateRoleDto : CreateRoleDto
{
    public bool IsActive { get; set; } = true;
}

public class RoleFilterRequest : FilterRequest { }

public class RoleDropdownDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}

// ─── Available permissions list ───────────────────────────────────────────────

public class PermissionGroupDto
{
    public string         Group       { get; set; } = string.Empty;
    public List<string>   Permissions { get; set; } = [];
}
