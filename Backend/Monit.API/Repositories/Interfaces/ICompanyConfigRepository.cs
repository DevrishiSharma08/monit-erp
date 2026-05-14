using Monit.API.Models.Entities.Config;

namespace Monit.API.Repositories.Interfaces;

public interface ICompanyConfigRepository
{
    Task<CompanyConfig> GetAsync();
    Task               UpsertAsync(CompanyConfig entity);
}
