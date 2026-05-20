using Monit.API.Models.DTOs.Config;
using Monit.API.Models.Entities.Config;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Config;

public class CompanyConfigService(ICompanyConfigRepository repo) : ICompanyConfigService
{
    public async Task<List<CompanyConfigDto>> GetAllAsync()
    {
        var list = await repo.GetAllAsync();
        return list.Select(ToDto).ToList();
    }

    public async Task<CompanyConfigDto> GetAsync(int id = 1)
        => ToDto(await repo.GetAsync(id));

    public async Task<CompanyConfigDto> UpdateAsync(int id, UpdateCompanyConfigDto dto, string updatedBy)
    {
        await repo.UpsertAsync(new CompanyConfig
        {
            Id                = id,
            CompanyName       = dto.CompanyName?.Trim(),
            InsurancePolicyNo = dto.InsurancePolicyNo?.Trim(),
            InsurancePolicyFy = dto.InsurancePolicyFy?.Trim(),
            InsuranceIssuer   = dto.InsuranceIssuer?.Trim(),
            SmtpSenderEmail   = dto.SmtpSenderEmail?.Trim(),
            SmtpSenderName    = dto.SmtpSenderName?.Trim(),
            SmtpAppPassword   = dto.SmtpAppPassword,
            UpdatedAt         = DateTime.UtcNow,
            UpdatedBy         = updatedBy,
        });
        return await GetAsync(id);
    }

    private static CompanyConfigDto ToDto(CompanyConfig e) => new()
    {
        Id                = e.Id,
        CompanyName       = e.CompanyName,
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
