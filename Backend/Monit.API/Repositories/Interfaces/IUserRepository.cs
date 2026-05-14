using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;

namespace Monit.API.Repositories.Interfaces;

public interface IUserRepository
{
    Task<PagedResult<UserListDto>>  GetAllAsync(UserFilterRequest filter);
    Task<List<UserListDto>>         GetAllForExportAsync(UserFilterRequest filter);
    Task<UserDetailDto?>            GetByIdAsync(int id);
    Task<List<UserDropdownDto>>     GetDropdownAsync();
    Task<bool>                      UsernameExistsAsync(string username, int? excludeId = null);
    Task<int>                       CreateAsync(User user);
    Task                            UpdateAsync(User user);
    Task                            UpdatePasswordAsync(int id, string password, string updatedBy);
    Task                            SoftDeleteAsync(int id, string deletedBy);
}
