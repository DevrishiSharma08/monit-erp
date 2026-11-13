using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Services.Interfaces;

public interface IPurchaseOrderService
{
    Task<PagedResult<PurchaseOrderListDto>> GetAllAsync(PurchaseOrderFilterRequest filter);
    Task<PurchaseOrderListDto>              GetByIdAsync(int id);
    Task<PurchaseOrderListDto>              CreateAsync(CreatePurchaseOrderDto dto, string createdBy);
    Task<PurchaseOrderListDto>              UpdateAsync(int id, UpdatePurchaseOrderDto dto, string updatedBy);
    Task                                    ApproveAsync(int id, string updatedBy);
    Task                                    DeleteAsync(int id, string deletedBy);
    Task<PurchaseOrderListDto>              CancelAsync(int id, CancelPurchaseOrderDto dto, string cancelledBy);
    Task<SendMailResponseDto>               SendEmailAsync(int id, SendMailRequestDto dto);
    Task<byte[]>                            GetPdfAsync(int id);
    Task<byte[]>                            GetImageAsync(int id);
    Task<byte[]>                            GetBulkPdfAsync(int[] ids);
    // ZIP of individual per-PO PDFs.
    Task<byte[]>                            GetBulkPdfZipAsync(int[] ids);
}
