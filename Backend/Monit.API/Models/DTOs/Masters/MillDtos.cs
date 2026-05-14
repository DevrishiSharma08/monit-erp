using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

// ─── Nested DTOs ──────────────────────────────────────────────────────────────

public class MillContactDto
{
    public int?    Id            { get; set; }
    public string  ContactPerson { get; set; } = string.Empty;
    public string? Designation   { get; set; }
    public string? Phone         { get; set; }
    public string? Email         { get; set; }
}

public class MillUnitDto
{
    public int?    Id       { get; set; }
    public string  UnitName { get; set; } = string.Empty;
    public string? Address  { get; set; }
    public List<MillContactDto> Contacts { get; set; } = new();
}

// ─── List (grid row) ─────────────────────────────────────────────────────────

public class MillListDto
{
    public int      Id           { get; set; }
    public string   Code         { get; set; } = string.Empty;
    public string   Name         { get; set; } = string.Empty;
    public string?  OwnerName    { get; set; }
    public string?  Phone        { get; set; }
    public string?  Email        { get; set; }
    public string?  GstNo        { get; set; }
    public string?  PaymentTerms { get; set; }
    public int      UnitCount    { get; set; }
    public bool     IsActive     { get; set; }
    public DateTime CreatedAt    { get; set; }
}

// ─── Detail (edit modal / view) ──────────────────────────────────────────────

public class MillDetailDto : MillListDto
{
    public List<MillUnitDto> Units     { get; set; } = new();
    public DateTime?         UpdatedAt { get; set; }
    public string?           UpdatedBy { get; set; }
}

// ─── Create ──────────────────────────────────────────────────────────────────

public class CreateMillDto
{
    public string            Code         { get; set; } = string.Empty;
    public string            Name         { get; set; } = string.Empty;
    public string?           OwnerName    { get; set; }
    public string?           Phone        { get; set; }
    public string?           Email        { get; set; }
    public string?           GstNo        { get; set; }
    public string?           PaymentTerms { get; set; }
    public List<MillUnitDto> Units        { get; set; } = new();
}

// ─── Update ──────────────────────────────────────────────────────────────────

public class UpdateMillDto : CreateMillDto
{
    public bool IsActive { get; set; } = true;
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

public class MillDropdownDto
{
    public int    Id   { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

// ─── Filter ──────────────────────────────────────────────────────────────────

public class MillFilterRequest : FilterRequest { }
