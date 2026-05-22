using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;

namespace Monit.API.Repositories.Interfaces;

public interface IRoleRepository
{
    Task<PagedResult<RoleListDto>>  GetAllAsync(RoleFilterRequest filter);
    Task<RoleDetailDto?>            GetByIdAsync(int id);
    Task<List<RoleDropdownDto>>     GetDropdownAsync();
    Task<bool>                      NameExistsAsync(string name, int? excludeId = null);
    Task<int?>                      FindSoftDeletedByNameAsync(string name);
    Task                            RestoreAsync(int id, string restoredBy);
    Task<int>                       CreateAsync(Role role);
    Task                            UpdateAsync(Role role);
    Task                            SoftDeleteAsync(int id, string deletedBy);
}
