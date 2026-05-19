using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Monit.API.Models.DTOs.Mail;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.System;

public class EmailService(ICompanyConfigRepository configRepo) : IEmailService
{
    public async Task SendAsync(SendMailRequestDto dto,
                                byte[]?           pdfBytes    = null,
                                string?           pdfFileName = null)
    {
        var cfg = await configRepo.GetAsync();

        if (string.IsNullOrWhiteSpace(cfg.SmtpSenderEmail) ||
            string.IsNullOrWhiteSpace(cfg.SmtpAppPassword))
            throw new InvalidOperationException(
                "SMTP credentials not configured. Go to Company Settings → Email & SMTP.");

        var senderName  = cfg.SmtpSenderName?.Trim() ?? "Monit Paper Agency";
        var senderEmail = cfg.SmtpSenderEmail.Trim();
        var appPassword = cfg.SmtpAppPassword.Trim();

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(senderName, senderEmail));

        foreach (var addr in dto.To.Where(a => !string.IsNullOrWhiteSpace(a)))
            message.To.Add(MailboxAddress.Parse(addr.Trim()));

        foreach (var addr in dto.Cc.Where(a => !string.IsNullOrWhiteSpace(a)))
            message.Cc.Add(MailboxAddress.Parse(addr.Trim()));

        message.Subject = dto.Subject;

        var bodyBuilder = new BodyBuilder { TextBody = dto.Body };

        if (pdfBytes?.Length > 0 && !string.IsNullOrWhiteSpace(pdfFileName))
            bodyBuilder.Attachments.Add(pdfFileName, pdfBytes,
                new ContentType("application", "pdf"));

        message.Body = bodyBuilder.ToMessageBody();

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
        await smtp.AuthenticateAsync(senderEmail, appPassword);
        await smtp.SendAsync(message);
        await smtp.DisconnectAsync(true);
    }
}
