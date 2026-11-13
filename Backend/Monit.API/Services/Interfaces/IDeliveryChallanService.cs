using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Services.Interfaces;

public interface IDeliveryChallanService
{
    Task<PagedResult<DeliveryChallanDto>> GetAllAsync(DeliveryChallanFilterRequest filter);
    Task<DeliveryChallanDto>              GetByIdAsync(int id);

    Task<List<OpenSoForDcDto>>            GetOpenSosAsync(int? customerId);
    Task<List<AvailableStockSourceDto>>   GetAvailableSourcesForSoLineAsync(int soLineId);

    Task<DeliveryChallanDto>              CreateAsync(CreateDeliveryChallanDto dto, string createdBy);
    Task<DeliveryChallanDto>              UpdateStatusAsync(int id, UpdateDeliveryChallanStatusDto dto, string updatedBy);
    Task                                  DeleteAsync(int id, string deletedBy);

    // Called from GrnService whenever a GRN ships some qty direct-to-client.
    // Returns the new DC id if it could be auto-created, else null.
    Task<int?>                            AutoCreateDraftFromGrnAsync(int grnId, decimal directQty, string createdBy);

    Task<byte[]>                          GetPdfAsync(int id);
    Task<byte[]>                          GetImageAsync(int id);
}
