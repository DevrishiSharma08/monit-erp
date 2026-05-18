using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

// ─── Transporter ──────────────────────────────────────────────────────────────

public class TransporterListDto
{
    public int      Id           { get; set; }
    public string   Name         { get; set; } = string.Empty;
    public string?  Phone        { get; set; }
    public string?  Email        { get; set; }
    public string?  GstNo        { get; set; }
    public int      VehicleCount { get; set; }
    public bool     IsActive     { get; set; }
    public DateTime CreatedAt    { get; set; }
}

public class TransporterDetailDto : TransporterListDto
{
    public string?   Address    { get; set; }
    public string?   PanNo      { get; set; }
    public decimal?  TdsPercent { get; set; }
    public DateTime? UpdatedAt  { get; set; }
    public string?   UpdatedBy  { get; set; }
    public List<TransporterVehicleDto> Vehicles { get; set; } = [];
}

public class CreateTransporterDto
{
    public string   Name       { get; set; } = string.Empty;
    public string?  Phone      { get; set; }
    public string?  Email      { get; set; }
    public string?  Address    { get; set; }
    public string?  GstNo      { get; set; }
    public string?  PanNo      { get; set; }
    public decimal? TdsPercent { get; set; }
    public List<UpsertTransporterVehicleDto> Vehicles { get; set; } = [];
}

public class UpdateTransporterDto : CreateTransporterDto
{
    public bool IsActive { get; set; } = true;
}

public class TransporterFilterRequest : FilterRequest { }

public class TransporterDropdownDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}

// ─── Transporter Vehicles ────────────────────────────────────────────────────

public class TransporterVehicleDto
{
    public int      Id           { get; set; }
    public string   VehicleType  { get; set; } = string.Empty;
    public decimal? Capacity     { get; set; }
    public string?  CapacityUnit { get; set; }
    public decimal? FreightRate  { get; set; }
    public bool     IsActive     { get; set; }
}

public class UpsertTransporterVehicleDto
{
    public int?     Id           { get; set; }
    public string   VehicleType  { get; set; } = string.Empty;
    public decimal? Capacity     { get; set; }
    public string?  CapacityUnit { get; set; }
    public decimal? FreightRate  { get; set; }
}
