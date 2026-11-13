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
    Task                                 ApproveAsync(int id, string updatedBy);
    Task                                 DeleteAsync(int id, string deletedBy);
    Task<SalesOrderListDto>              CancelAsync(int id, CancelSalesOrderDto dto, string cancelledBy);
    Task<SendMailResponseDto>            SendEmailAsync(int id, SendMailRequestDto dto);
    Task<byte[]>                         GetPdfAsync(int id);
    Task<byte[]>                         GetImageAsync(int id);
    Task<byte[]>                         GetBulkPdfAsync(int[] ids);
    // ZIP of individual per-SO PDFs — used by the grid Export when the user
    // wants one file per row instead of a single combined document.
    Task<byte[]>                         GetBulkPdfZipAsync(int[] ids);
}
