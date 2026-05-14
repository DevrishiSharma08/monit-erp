using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class SalesmanListDto
{
    public int     Id        { get; set; }
    public string  Code      { get; set; } = string.Empty;
    public string  Name      { get; set; } = string.Empty;
    public string? Phone     { get; set; }
    public string? Territory { get; set; }
    public bool    IsActive  { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SalesmanDetailDto : SalesmanListDto
{
    public string?   Email     { get; set; }
    public int?      UserId    { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateSalesmanDto
{
    public string  Code      { get; set; } = string.Empty;
    public string  Name      { get; set; } = string.Empty;
    public string? Phone     { get; set; }
    public string? Email     { get; set; }
    public string? Territory { get; set; }
    public int?    UserId    { get; set; }
}

public class UpdateSalesmanDto : CreateSalesmanDto
{
    public bool IsActive { get; set; } = true;
}

public class SalesmanFilterRequest : FilterRequest
{
    public string? Territory { get; set; }
}

public class SalesmanDropdownDto
{
    public int    Id   { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class SalesmanForSODto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}
