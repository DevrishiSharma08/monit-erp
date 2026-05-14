using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface ISalesmanRepository
{
    Task<PagedResult<SalesmanListDto>>  GetAllAsync(SalesmanFilterRequest filter);
    Task<List<SalesmanListDto>>         GetAllForExportAsync(SalesmanFilterRequest filter);
    Task<SalesmanDetailDto?>            GetByIdAsync(int id);
    Task<List<SalesmanDropdownDto>>     GetDropdownAsync();
    Task<List<SalesmanForSODto>>        GetForSOAsync();
    Task<bool>                          CodeExistsAsync(string code, int? excludeId = null);
    Task<int>                           CreateAsync(Salesman entity);
    Task                                UpdateAsync(Salesman entity);
    Task                                SoftDeleteAsync(int id, string deletedBy);
}
