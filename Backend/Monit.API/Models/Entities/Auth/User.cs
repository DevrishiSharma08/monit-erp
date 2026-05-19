using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Auth;

public class User : BaseEntity
{
    public string    Username           { get; set; } = string.Empty;
    public string?   Email              { get; set; }
    public string    Password           { get; set; } = string.Empty;
    public string    Name               { get; set; } = string.Empty;
    public int       RoleId             { get; set; }
    public string    Role               { get; set; } = string.Empty;
    public string?   CustomerName       { get; set; }
    public bool      IsActive           { get; set; } = true;
    public DateTime? LastLoginAt        { get; set; }
    public string?   RefreshToken       { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    // Joined from auth.Roles — not a DB column on Users
    public string?   RolePermissions    { get; set; }
}
