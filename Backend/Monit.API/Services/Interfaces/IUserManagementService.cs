using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;

namespace Monit.API.Services.Interfaces;

public interface IUserManagementService
{
    Task<PagedResult<UserListDto>>  GetAllAsync(UserFilterRequest filter);
    Task<UserDetailDto>             GetByIdAsync(int id);
    Task<List<UserDropdownDto>>     GetDropdownAsync();
    Task<UserDetailDto>             CreateAsync(CreateUserDto dto, string createdBy);
    Task<UserDetailDto>             UpdateAsync(int id, UpdateUserDto dto, string updatedBy);
    Task                            ResetPasswordAsync(int id, ResetPasswordDto dto, string updatedBy);
    Task                            DeleteAsync(int id, string deletedBy);
    Task<byte[]>                    ExportAsync(UserFilterRequest filter, string format);
}
