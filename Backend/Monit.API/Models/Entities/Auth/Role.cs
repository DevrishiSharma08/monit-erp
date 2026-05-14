using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Auth;

public class Role : BaseEntity
{
    public string  Name        { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Permissions { get; set; }   // JSON array stored as string
    public bool    IsActive    { get; set; } = true;
}
