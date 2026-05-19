using Monit.API.Common.Helpers;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Mail;
using Monit.API.Models.DTOs.Sales;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Sales;

public class SalesOrderService(
    ISalesOrderRepository  repo,
    IEmailService          emailSvc,
    ISalesOrderPdfService  pdfSvc,
    AppConfig              cfg) : ISalesOrderService
{
    public Task<PagedResult<SalesOrderListDto>> GetAllAsync(SalesOrderFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<SalesOrderListDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id)
           ?? throw new KeyNotFoundException($"Sales Order #{id} not found.");

    public async Task<SalesOrderListDto> CreateAsync(CreateSalesOrderDto dto, string createdBy)
    {
        if (dto.Lines.Count == 0)
            throw new ArgumentException("A sales order must have at least one line.");
        var id = await repo.CreateAsync(dto, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<SalesOrderListDto> UpdateAsync(int id, UpdateSalesOrderDto dto, string updatedBy)
    {
        if (dto.Lines.Count == 0)
            throw new ArgumentException("A sales order must have at least one line.");
        await repo.UpdateAsync(id, dto, updatedBy);
        return await GetByIdAsync(id);
    }

    public Task DeleteAsync(int id, string deletedBy)
        => repo.SoftDeleteAsync(id, deletedBy);

    public async Task<SendMailResponseDto> SendEmailAsync(int id, SendMailRequestDto dto)
    {
        if (dto.To.All(string.IsNullOrWhiteSpace))
            throw new ArgumentException("At least one recipient is required.");

        var so      = await GetByIdAsync(id);
        var pdfBytes = pdfSvc.Generate(so, cfg.CompanyName, cfg.CompanyAddress);
        var fileName = $"SO_{so.SONumber.Replace("/", "-")}_{DateTime.Today:yyyyMMdd}.pdf";

        await emailSvc.SendAsync(dto, pdfBytes, fileName);
        await repo.MarkEmailSentAsync(id);

        return new SendMailResponseDto
        {
            Success     = true,
            EmailSentAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
        };
    }
}
