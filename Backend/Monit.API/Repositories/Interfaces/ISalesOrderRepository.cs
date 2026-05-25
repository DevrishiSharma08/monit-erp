using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Sales;

namespace Monit.API.Repositories.Interfaces;

public interface ISalesOrderRepository
{
    Task<PagedResult<SalesOrderListDto>> GetAllAsync(SalesOrderFilterRequest filter);
    Task<SalesOrderListDto?>             GetByIdAsync(int id);
    Task<int>                            CreateAsync(CreateSalesOrderDto dto, string createdBy);
    Task                                 UpdateAsync(int id, UpdateSalesOrderDto dto, string updatedBy);
    Task                                 UpdateStatusAsync(int id, string status, string updatedBy);
    Task                                 SoftDeleteAsync(int id, string deletedBy);
    Task                                 MarkEmailSentAsync(int id);
    Task<List<SoLinkedPoDto>>            GetLinkedPOsAsync(int soId);
}
