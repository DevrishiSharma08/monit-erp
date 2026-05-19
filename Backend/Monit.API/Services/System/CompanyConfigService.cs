using Monit.API.Models.DTOs.Config;
using Monit.API.Models.Entities.Config;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Config;

public class CompanyConfigService(ICompanyConfigRepository repo) : ICompanyConfigService
{
    public async Task<CompanyConfigDto> GetAsync()
    {
        var e = await repo.GetAsync();
        return ToDto(e);
    }

    public async Task<CompanyConfigDto> UpdateAsync(UpdateCompanyConfigDto dto, string updatedBy)
    {
        await repo.UpsertAsync(new CompanyConfig
        {
            InsurancePolicyNo = dto.InsurancePolicyNo?.Trim(),
            InsurancePolicyFy = dto.InsurancePolicyFy?.Trim(),
            InsuranceIssuer   = dto.InsuranceIssuer?.Trim(),
            SmtpSenderEmail   = dto.SmtpSenderEmail?.Trim(),
            SmtpSenderName    = dto.SmtpSenderName?.Trim(),
            SmtpAppPassword   = dto.SmtpAppPassword,   // null = keep existing; "" = clear
            UpdatedAt         = DateTime.UtcNow,
            UpdatedBy         = updatedBy,
        });
        return await GetAsync();
    }

    private static CompanyConfigDto ToDto(CompanyConfig e) => new()
    {
        InsurancePolicyNo = e.InsurancePolicyNo,
        InsurancePolicyFy = e.InsurancePolicyFy,
        InsuranceIssuer   = e.InsuranceIssuer,
        SmtpSenderEmail   = e.SmtpSenderEmail,
        SmtpSenderName    = e.SmtpSenderName,
        SmtpConfigured    = !string.IsNullOrWhiteSpace(e.SmtpSenderEmail)
                         && !string.IsNullOrWhiteSpace(e.SmtpAppPassword),
        UpdatedAt         = e.UpdatedAt,
        UpdatedBy         = e.UpdatedBy,
    };
}
