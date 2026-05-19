using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface ICustomerService
{
    Task<PagedResult<CustomerListDto>>  GetAllAsync(CustomerFilterRequest filter);
    Task<CustomerDetailDto>             GetByIdAsync(int id);
    Task<List<CustomerDropdownDto>>     GetDropdownAsync();
    Task<List<CustomerSODropdownDto>>   GetForSOAsync();
    Task<CustomerDetailDto>             CreateAsync(CreateCustomerDto dto, string createdBy);
    Task<CustomerDetailDto>             UpdateAsync(int id, UpdateCustomerDto dto, string updatedBy);
    Task                                DeleteAsync(int id, string deletedBy);
    Task<byte[]>                        ExportAsync(CustomerFilterRequest filter, string format);
    Task<List<CustomerContactDto>>      GetContactsAsync(int customerId);
}
