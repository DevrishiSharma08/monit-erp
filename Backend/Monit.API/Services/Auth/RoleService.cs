using System.Text.Json;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Auth;

public class RoleService(IRoleRepository repo) : IRoleService
{
    public Task<PagedResult<RoleListDto>> GetAllAsync(RoleFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<RoleDropdownDto>>    GetDropdownAsync()                => repo.GetDropdownAsync();

    public async Task<RoleDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Role {id} not found.");

    public Task<List<PermissionGroupDto>> GetAvailablePermissionsAsync()
        => Task.FromResult(AvailablePermissions);

    public async Task<RoleDetailDto> CreateAsync(CreateRoleDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Role name is required.");
        if (await repo.NameExistsAsync(dto.Name.Trim()))
            throw new ConflictException($"Role '{dto.Name}' already exists.");

        var id = await repo.CreateAsync(new Role
        {
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Permissions = SerializePermissions(dto.Permissions),
            IsActive    = true,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<RoleDetailDto> UpdateAsync(int id, UpdateRoleDto dto, string updatedBy)
    {
        var existing = await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Role name is required.");

        // Protect Admin role name from being renamed
        if (existing.Name == "Admin" && dto.Name != "Admin")
            throw new ValidationException("Admin role name cannot be changed.");

        if (await repo.NameExistsAsync(dto.Name.Trim(), id))
            throw new ConflictException($"Role '{dto.Name}' is already used by another role.");

        await repo.UpdateAsync(new Role
        {
            Id          = id,
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Permissions = SerializePermissions(dto.Permissions),
            IsActive    = dto.IsActive,
            UpdatedAt   = DateTime.UtcNow,
            UpdatedBy   = updatedBy
        });
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        var role = await GetByIdAsync(id);
        if (role.Name == "Admin")
            throw new ValidationException("Admin role cannot be deleted.");
        if (role.UserCount > 0)
            throw new ValidationException($"Cannot delete role '{role.Name}' — {role.UserCount} user(s) are assigned to it.");
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    private static string SerializePermissions(List<string> perms)
        => JsonSerializer.Serialize(perms.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct().ToList());

    // ─── Master list of available permissions ────────────────────────────────
    private static readonly List<PermissionGroupDto> AvailablePermissions =
    [
        new() { Group = "Masters",     Permissions = ["masters.read", "masters.write", "masters.delete"] },
        new() { Group = "Inquiry",     Permissions = ["inquiry.read", "inquiry.write", "inquiry.delete"] },
        new() { Group = "Sales Order", Permissions = ["so.read", "so.write", "so.delete"] },
        new() { Group = "Purchase",    Permissions = ["po.read", "po.write", "po.delete"] },
        new() { Group = "Mill Track",  Permissions = ["mill.read", "mill.write"] },
        new() { Group = "GRN",         Permissions = ["grn.read", "grn.write", "grn.delete"] },
        new() { Group = "Stock",       Permissions = ["stock.read", "stock.write"] },
        new() { Group = "Logistics",   Permissions = ["logistics.read", "logistics.write"] },
        new() { Group = "Reports",     Permissions = ["reports.read"] },
        new() { Group = "Users",       Permissions = ["users.read", "users.write", "users.delete"] },
    ];
}
