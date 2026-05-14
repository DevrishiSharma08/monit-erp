namespace Monit.API.Models.Entities.Base;

/// <summary>
/// Every table has these columns — audit trail + soft delete.
/// </summary>
public abstract class BaseEntity
{
    public int       Id         { get; set; }
    public DateTime  CreatedAt  { get; set; }
    public string    CreatedBy  { get; set; } = string.Empty;
    public DateTime? UpdatedAt  { get; set; }
    public string?   UpdatedBy  { get; set; }
    public bool      IsDeleted  { get; set; } = false;
    public DateTime? DeletedAt  { get; set; }
    public string?   DeletedBy  { get; set; }
}
