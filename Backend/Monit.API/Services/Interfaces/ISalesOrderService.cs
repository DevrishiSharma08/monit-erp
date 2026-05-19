using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
using Monit.API.Models.DTOs.Sales;

namespace Monit.API.Services.Interfaces;

public interface ISalesOrderService
{
    Task<PagedResult<SalesOrderListDto>> GetAllAsync(SalesOrderFilterRequest filter);
    Task<SalesOrderListDto>              GetByIdAsync(int id);
    Task<SalesOrderListDto>              CreateAsync(CreateSalesOrderDto dto, string createdBy);
    Task<SalesOrderListDto>              UpdateAsync(int id, UpdateSalesOrderDto dto, string updatedBy);
    Task                                 DeleteAsync(int id, string deletedBy);
    Task<SendMailResponseDto>            SendEmailAsync(int id, SendMailRequestDto dto);
}
