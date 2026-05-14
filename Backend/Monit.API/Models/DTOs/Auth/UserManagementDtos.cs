using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Auth;

// ─── List / Detail ────────────────────────────────────────────────────────────

public class UserListDto
{
    public int      Id          { get; set; }
    public string   Username    { get; set; } = string.Empty;
    public string   Name        { get; set; } = string.Empty;
    public string?  Email       { get; set; }
    public int      RoleId      { get; set; }
    public string   Role        { get; set; } = string.Empty;
    public bool     IsActive    { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt   { get; set; }
}

public class UserDetailDto : UserListDto
{
    public string?   CustomerName { get; set; }
    public DateTime? UpdatedAt    { get; set; }
    public string?   UpdatedBy    { get; set; }
    public string?   CreatedBy    { get; set; }
}

// ─── Create / Update ──────────────────────────────────────────────────────────

public class CreateUserDto
{
    public string  Username     { get; set; } = string.Empty;
    public string  Password     { get; set; } = string.Empty;
    public string  Name         { get; set; } = string.Empty;
    public string? Email        { get; set; }
    public int     RoleId       { get; set; }
    public string? CustomerName { get; set; }
}

public class UpdateUserDto
{
    public string  Name         { get; set; } = string.Empty;
    public string? Email        { get; set; }
    public int     RoleId       { get; set; }
    public string? CustomerName { get; set; }
    public bool    IsActive     { get; set; } = true;
}

public class ResetPasswordDto
{
    public string NewPassword { get; set; } = string.Empty;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

public class UserFilterRequest : FilterRequest
{
    public int?    RoleId   { get; set; }
    public string? Role     { get; set; }
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

public class UserDropdownDto
{
    public int    Id       { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Name     { get; set; } = string.Empty;
    public string Role     { get; set; } = string.Empty;
}
