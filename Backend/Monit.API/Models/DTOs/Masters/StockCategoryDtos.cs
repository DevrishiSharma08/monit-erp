using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class StockCategoryListDto
{
    public int     Id             { get; set; }
    public string  Code           { get; set; } = string.Empty;
    public string  Name           { get; set; } = string.Empty;
    public int?    StockGroupId   { get; set; }
    public string? StockGroupName { get; set; }
    public string  GsmType        { get; set; } = "single";
    public int?    Gsm            { get; set; }
    public int?    GsmMin         { get; set; }
    public int?    GsmMax         { get; set; }
    public bool    IsActive       { get; set; }
    public DateTime CreatedAt     { get; set; }
}

public class StockCategoryDetailDto : StockCategoryListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateStockCategoryDto
{
    public string GsmType { get; set; } = "single";
    public int?   Gsm     { get; set; }
    public int?   GsmMin  { get; set; }
    public int?   GsmMax  { get; set; }
}

public class UpdateStockCategoryDto : CreateStockCategoryDto
{
    public bool IsActive { get; set; } = true;
}

public class StockCategoryFilterRequest : FilterRequest
{
    public int? StockGroupId { get; set; }
}

public class BulkCreateGsmDto
{
    public List<CreateStockCategoryDto> Items { get; set; } = new();
}

public class StockCategoryDropdownDto
{
    public int    Id             { get; set; }
    public string Code           { get; set; } = string.Empty;
    public string Name           { get; set; } = string.Empty;
    public int?   StockGroupId   { get; set; }
    public string? StockGroupName { get; set; }
}
