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
        UpdatedAt         = e.UpdatedAt,
        UpdatedBy         = e.UpdatedBy,
    };
}
