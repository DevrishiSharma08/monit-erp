using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface ISalesmanService
{
    Task<PagedResult<SalesmanListDto>>  GetAllAsync(SalesmanFilterRequest filter);
    Task<SalesmanDetailDto>             GetByIdAsync(int id);
    Task<List<SalesmanDropdownDto>>     GetDropdownAsync();
    Task<List<SalesmanForSODto>>        GetForSOAsync();
    Task<SalesmanDetailDto>             CreateAsync(CreateSalesmanDto dto, string createdBy);
    Task<SalesmanDetailDto>             UpdateAsync(int id, UpdateSalesmanDto dto, string updatedBy);
    Task                                DeleteAsync(int id, string deletedBy);
    Task<byte[]>                        ExportAsync(SalesmanFilterRequest filter, string format);
}
