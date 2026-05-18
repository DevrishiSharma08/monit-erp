using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class CustomerService(
    ICustomerRepository repo,
    IExportService      exportService,
    AppConfig           appConfig) : ICustomerService
{
    public Task<PagedResult<CustomerListDto>>  GetAllAsync(CustomerFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<CustomerDropdownDto>>     GetDropdownAsync()                   => repo.GetDropdownAsync();
    public Task<List<CustomerSODropdownDto>>   GetForSOAsync()                      => repo.GetForSOAsync();

    public async Task<CustomerDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Customer {id} not found.");

    public async Task<CustomerDetailDto> CreateAsync(CreateCustomerDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");

        var customer  = MapToEntity(dto, createdBy);
        var contacts  = dto.Contacts.Select(MapContact).ToList();
        var locations = dto.DeliveryLocations.Select(MapLocation).ToList();

        var id = await repo.CreateAsync(customer, contacts, locations, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<CustomerDetailDto> UpdateAsync(int id, UpdateCustomerDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");

        var customer = MapToEntity(dto, updatedBy, id);
        customer.IsActive  = dto.IsActive;
        customer.UpdatedAt = DateTime.UtcNow;
        customer.UpdatedBy = updatedBy;

        var contacts  = dto.Contacts.Select(MapContact).ToList();
        var locations = dto.DeliveryLocations.Select(MapLocation).ToList();

        await repo.UpdateAsync(customer, contacts, locations, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(CustomerFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Name", "Owner", "Phone", "Email", "GST No", "Credit Limit", "Credit Days", "Status" };
        var rows    = data.Select(x => new List<string>
        {
            x.Name, x.OwnerName ?? "", x.Phone ?? "", x.Email ?? "", x.GSTNo ?? "",
            x.CreditLimit.ToString("N2"), x.CreditDays.ToString(),
            x.IsActive ? "Active" : "Inactive"
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Customers", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Customer Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Customer Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    private static Customer MapToEntity(CreateCustomerDto dto, string createdBy, int id = 0) => new()
    {
        Id             = id,
        Name           = dto.Name.Trim(),
        OwnerName      = dto.OwnerName?.Trim(),
        Phone          = dto.Phone?.Trim(),
        Email          = dto.Email?.Trim().ToLower(),
        GSTNo          = dto.GSTNo?.Trim().ToUpper(),
        BillingAddress = dto.BillingAddress?.Trim(),
        CreditLimit    = dto.CreditLimit,
        CreditDays     = dto.CreditDays,
        PaymentTerms   = dto.PaymentTerms?.Trim(),
        LocalityId     = dto.LocalityId,
        IsActive       = true,
        CreatedAt      = DateTime.UtcNow,
        CreatedBy      = createdBy
    };

    private static CustomerContact MapContact(UpsertCustomerContactDto d) => new()
    {
        Name        = d.Name.Trim(),
        Designation = d.Designation?.Trim(),
        Phone       = d.Phone?.Trim(),
        Email       = d.Email?.Trim().ToLower(),
        IsDefault   = d.IsDefault
    };

    private static CustomerDeliveryLocation MapLocation(UpsertCustomerDeliveryLocationDto d) => new()
    {
        Label     = d.Label?.Trim(),
        Address   = d.Address.Trim(),
        IsDefault = d.IsDefault
    };
}
