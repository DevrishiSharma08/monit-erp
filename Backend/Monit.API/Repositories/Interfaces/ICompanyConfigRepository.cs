using Monit.API.Models.Entities.Config;

namespace Monit.API.Repositories.Interfaces;

public interface ICompanyConfigRepository
{
    Task<List<CompanyConfig>> GetAllAsync();
    Task<CompanyConfig>       GetAsync(int id = 1);
    Task                      UpsertAsync(CompanyConfig entity);
}
