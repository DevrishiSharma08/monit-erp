using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

// Subgroup item returned in list/detail responses
public class SubgroupDto
{
    public int     Id    { get; set; }
    public string  Name  { get; set; } = string.Empty;
    public string? Alias { get; set; }
}

// Subgroup input in create/update requests
public class SubgroupInputDto
{
    public string  Name  { get; set; } = string.Empty;
    public string? Alias { get; set; }
}

public class StockGroupListDto
{
    public int      Id          { get; set; }
    public string   Name        { get; set; } = string.Empty;
    public string?  Description { get; set; }
    public bool     IsActive    { get; set; }
    public DateTime CreatedAt   { get; set; }

    // Dapper maps this; JSON serializer ignores it and emits Subgroups[]
    // Format: id\x1Fname\x1Falias records separated by \x1E
    [System.Text.Json.Serialization.JsonIgnore]
    public string? SubgroupsCsv { get; set; }

    public List<SubgroupDto> Subgroups =>
        SubgroupsCsv is null ? [] :
        SubgroupsCsv.Split('\x1E', StringSplitOptions.RemoveEmptyEntries)
                    .Select(part =>
                    {
                        var bits = part.Split('\x1F');
                        return new SubgroupDto
                        {
                            Id    = bits.Length > 0 && int.TryParse(bits[0], out var id) ? id : 0,
                            Name  = bits.Length > 1 ? bits[1] : string.Empty,
                            Alias = bits.Length > 2 && bits[2].Length > 0 ? bits[2] : null,
                        };
                    })
                    .ToList();
}

public class StockGroupDetailDto : StockGroupListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateStockGroupDto
{
    public string              Name        { get; set; } = string.Empty;
    public string?             Description { get; set; }
    public List<SubgroupInputDto> Subgroups { get; set; } = new();
}

public class UpdateStockGroupDto : CreateStockGroupDto
{
    public bool IsActive { get; set; } = true;
}

public class StockGroupFilterRequest : FilterRequest { }

public class StockGroupDropdownDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class SubGroupDropdownDto
{
    public int     Id        { get; set; }
    public int     GroupId   { get; set; }
    public string  GroupName { get; set; } = string.Empty;
    public string  Name      { get; set; } = string.Empty;
    public string? Alias     { get; set; }
}
