using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;

namespace Monit.API.Services.Interfaces;

public interface IRoleService
{
    Task<PagedResult<RoleListDto>>    GetAllAsync(RoleFilterRequest filter);
    Task<RoleDetailDto>               GetByIdAsync(int id);
    Task<List<RoleDropdownDto>>       GetDropdownAsync();
    Task<List<PermissionGroupDto>>    GetAvailablePermissionsAsync();
    Task<RoleDetailDto>               CreateAsync(CreateRoleDto dto, string createdBy);
    Task<RoleDetailDto>               UpdateAsync(int id, UpdateRoleDto dto, string updatedBy);
    Task                              DeleteAsync(int id, string deletedBy);
}
