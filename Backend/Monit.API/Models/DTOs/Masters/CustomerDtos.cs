using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

// ─── List / Detail ───────────────────────────────────────────────────────────

public class CustomerListDto
{
    public int      Id            { get; set; }
    public string   Name          { get; set; } = string.Empty;
    public string?  OwnerName     { get; set; }
    public string?  Phone         { get; set; }
    public string?  Email         { get; set; }
    public string?  GSTNo         { get; set; }
    public decimal  CreditLimit   { get; set; }
    public int      CreditDays    { get; set; }
    public string?  PaymentTerms  { get; set; }
    public int?     LocalityId    { get; set; }
    public string?  Locality      { get; set; }
    public bool     IsActive      { get; set; }
    public DateTime CreatedAt     { get; set; }
}

public class CustomerDetailDto : CustomerListDto
{
    public string?    BillingAddress    { get; set; }
    public DateTime?  UpdatedAt         { get; set; }
    public string?    UpdatedBy         { get; set; }
    public List<CustomerContactDto>          Contacts          { get; set; } = [];
    public List<CustomerDeliveryLocationDto> DeliveryLocations { get; set; } = [];
}

// ─── Create / Update ─────────────────────────────────────────────────────────

public class CreateCustomerDto
{
    public string   Name           { get; set; } = string.Empty;
    public string?  OwnerName      { get; set; }
    public string?  Phone          { get; set; }
    public string?  Email          { get; set; }
    public string?  GSTNo          { get; set; }
    public string?  BillingAddress { get; set; }
    public decimal  CreditLimit    { get; set; } = 0;
    public int      CreditDays     { get; set; } = 0;
    public string?  PaymentTerms   { get; set; }
    public int?     LocalityId     { get; set; }
    public List<UpsertCustomerContactDto>          Contacts          { get; set; } = [];
    public List<UpsertCustomerDeliveryLocationDto> DeliveryLocations { get; set; } = [];
}

public class UpdateCustomerDto : CreateCustomerDto
{
    public bool IsActive { get; set; } = true;
}

// ─── Contact sub-entity ───────────────────────────────────────────────────────

public class CustomerContactDto
{
    public int     Id          { get; set; }
    public string  Name        { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string? Phone       { get; set; }
    public string? Email       { get; set; }
}

public class UpsertCustomerContactDto
{
    public int?    Id          { get; set; }
    public string  Name        { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string? Phone       { get; set; }
    public string? Email       { get; set; }
}

// ─── Delivery Location sub-entity ────────────────────────────────────────────

public class CustomerDeliveryLocationDto
{
    public int     Id        { get; set; }
    public string? Label     { get; set; }
    public string  Address   { get; set; } = string.Empty;
    public bool    IsDefault { get; set; }
}

public class UpsertCustomerDeliveryLocationDto
{
    public int?    Id        { get; set; }
    public string? Label     { get; set; }
    public string  Address   { get; set; } = string.Empty;
    public bool    IsDefault { get; set; } = false;
}

// ─── Filter / Dropdown ────────────────────────────────────────────────────────

public class CustomerFilterRequest : FilterRequest { }

public class CustomerDropdownDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}

// ─── SO Form Dropdown (rich — includes contacts + delivery addresses) ─────────

public class CustomerSODropdownDto
{
    public int     Id             { get; set; }
    public string  Company        { get; set; } = string.Empty;   // customer Name
    public string? GstNo          { get; set; }
    public int     CreditDays     { get; set; }
    public decimal CreditLimit    { get; set; }
    public string? Phone          { get; set; }
    public string? Email          { get; set; }
    public string? BillingAddress { get; set; }
    public string? PaymentTerms   { get; set; }
    public List<CustomerContactSODto>          Contacts          { get; set; } = [];
    public List<CustomerDeliveryLocationSODto> DeliveryAddresses { get; set; } = [];
}

public class CustomerContactSODto
{
    public int     Id          { get; set; }
    public string  Name        { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string? Phone       { get; set; }
    public string? Email       { get; set; }
}

public class CustomerDeliveryLocationSODto
{
    public int     Id        { get; set; }
    public string? Label     { get; set; }
    public string  Address   { get; set; } = string.Empty;
    public bool    IsDefault { get; set; }
}
