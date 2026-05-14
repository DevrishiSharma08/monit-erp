namespace Monit.API.Common.Response;

public class PagedResult<T>
{
    public List<T> Items      { get; set; } = [];
    public int     Page       { get; set; }
    public int     PageSize   { get; set; }
    public int     Total      { get; set; }
    public int     TotalPages => (int)Math.Ceiling((double)Total / PageSize);
    public bool    HasNext    => Page < TotalPages;
    public bool    HasPrev    => Page > 1;
}
