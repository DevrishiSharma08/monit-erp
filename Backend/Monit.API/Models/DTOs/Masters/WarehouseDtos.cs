using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

// ─── Warehouse ───────────────────────────────────────────────────────────────

public class WarehouseListDto
{
    public int      Id         { get; set; }
    public string   Unit       { get; set; } = string.Empty;
    public string   Name       { get; set; } = string.Empty;
    public int      BinCount   { get; set; }
    public int      RackCount  { get; set; }
    public bool     IsActive   { get; set; }
    public DateTime CreatedAt  { get; set; }
}

public class WarehouseDetailDto : WarehouseListDto
{
    public DateTime?           UpdatedAt { get; set; }
    public string?             UpdatedBy { get; set; }
    public List<WarehouseBinDetailDto> Bins { get; set; } = [];
}

public class CreateWarehouseDto
{
    public string Unit { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<UpsertWarehouseBinDto> Bins { get; set; } = [];
}

public class UpdateWarehouseDto : CreateWarehouseDto
{
    public bool IsActive { get; set; } = true;
}

public class WarehouseFilterRequest : FilterRequest { }

public class WarehouseDropdownDto
{
    public int    Id   { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

// ─── Warehouse Bins ──────────────────────────────────────────────────────────

public class WarehouseBinDetailDto
{
    public int    Id       { get; set; }
    public string Name     { get; set; } = string.Empty;
    public bool   IsActive { get; set; }
    public List<WarehouseRackDto> Racks { get; set; } = [];
}

public class UpsertWarehouseBinDto
{
    public int?    Id       { get; set; }
    public string  Name     { get; set; } = string.Empty;
    public bool    IsActive { get; set; } = true;
    public List<UpsertWarehouseRackDto> Racks { get; set; } = [];
}

// ─── Warehouse Racks ─────────────────────────────────────────────────────────

public class WarehouseRackDto
{
    public int    Id         { get; set; }
    public string Name       { get; set; } = string.Empty;
    public int    StackCount { get; set; }
    public bool   IsActive   { get; set; }
}

public class UpsertWarehouseRackDto
{
    public int?   Id         { get; set; }
    public string Name       { get; set; } = string.Empty;
    public int    StackCount { get; set; } = 1;
    public bool   IsActive   { get; set; } = true;
}
