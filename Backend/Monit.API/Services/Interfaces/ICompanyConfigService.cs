using Monit.API.Models.DTOs.Config;

namespace Monit.API.Services.Interfaces;

public interface ICompanyConfigService
{
    Task<List<CompanyConfigDto>> GetAllAsync();
    Task<CompanyConfigDto>       GetAsync(int id = 1);
    Task<CompanyConfigDto>       UpdateAsync(int id, UpdateCompanyConfigDto dto, string updatedBy);
}
