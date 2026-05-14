using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface ICustomerRepository
{
    Task<PagedResult<CustomerListDto>>  GetAllAsync(CustomerFilterRequest filter);
    Task<List<CustomerListDto>>         GetAllForExportAsync(CustomerFilterRequest filter);
    Task<CustomerDetailDto?>            GetByIdAsync(int id);
    Task<List<CustomerDropdownDto>>     GetDropdownAsync();
    Task<List<CustomerSODropdownDto>>   GetForSOAsync();
    Task<int>                           CreateAsync(Customer customer, IEnumerable<CustomerContact> contacts, IEnumerable<CustomerDeliveryLocation> locations, string createdBy);
    Task                                UpdateAsync(Customer customer, IEnumerable<CustomerContact> contacts, IEnumerable<CustomerDeliveryLocation> locations, string updatedBy);
    Task                                SoftDeleteAsync(int id, string deletedBy);
}
