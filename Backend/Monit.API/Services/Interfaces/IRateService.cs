using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IRateService
{
    Task<PagedResult<RateListDto>>  GetCurrentRatesAsync(RateFilterRequest filter);
    Task<List<SORateDto>>           GetForCustomerAsync(int customerId);
    Task<List<RateHistoryDto>>      GetHistoryAsync(int rateId);
    Task<List<RateListDto>>         CreateSaleRatesAsync(CreateSaleRateDto dto, string createdBy);
    Task<List<RateListDto>>         CreatePurchaseRatesAsync(CreatePurchaseRateDto dto, string createdBy);
    Task                            DeleteAsync(int id, string deletedBy);
    Task<byte[]>                    ExportAsync(RateFilterRequest filter, string format);
}
