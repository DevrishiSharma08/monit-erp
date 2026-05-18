using Monit.API.Models.DTOs.Config;

namespace Monit.API.Services.Interfaces;

public interface ICompanyConfigService
{
    Task<CompanyConfigDto> GetAsync();
    Task<CompanyConfigDto> UpdateAsync(UpdateCompanyConfigDto dto, string updatedBy);
}
