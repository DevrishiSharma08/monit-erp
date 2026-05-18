using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IRateRepository
{
    Task<PagedResult<RateListDto>>  GetCurrentRatesAsync(RateFilterRequest filter);
    Task<List<RateListDto>>         GetAllForExportAsync(RateFilterRequest filter);
    Task<List<RateHistoryDto>>      GetHistoryAsync(int rateId);
    Task<List<SORateDto>>           GetForCustomerAsync(int customerId);
    Task<int>                       CreateAsync(Rate entity);
    Task                            SoftDeleteAsync(int id, string deletedBy);
}
