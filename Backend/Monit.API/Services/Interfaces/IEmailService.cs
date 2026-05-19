using Monit.API.Models.DTOs.Mail;

namespace Monit.API.Services.Interfaces;

public interface IEmailService
{
    /// <summary>
    /// Sends an email using SMTP credentials stored in system.CompanyConfig.
    /// Optionally attaches a PDF byte array with the given filename.
    /// </summary>
    Task SendAsync(SendMailRequestDto dto,
                   byte[]?           pdfBytes      = null,
                   string?           pdfFileName   = null);
}
