namespace Monit.API.Common.Response;

/// <summary>
/// Base query parameters shared by every list endpoint.
/// Inherit to add entity-specific filters.
/// </summary>
public class FilterRequest
{
    public string? Search    { get; set; }
    public string? SortBy    { get; set; } = "CreatedAt";
    public string  SortOrder { get; set; } = "desc";   // asc / desc
    public int     Page      { get; set; } = 1;
    public int     PageSize  { get; set; } = 50;
    public bool?   IsActive  { get; set; }
    public string? FromDate  { get; set; }
    public string? ToDate    { get; set; }

    public int Offset => (Page - 1) * PageSize;

    public string SafeSortOrder => SortOrder?.ToLower() == "asc" ? "ASC" : "DESC";
}
