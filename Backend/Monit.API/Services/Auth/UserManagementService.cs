using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Auth;

public class UserManagementService(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    IExportService  exportService,
    AppConfig       appConfig) : IUserManagementService
{
    public Task<PagedResult<UserListDto>> GetAllAsync(UserFilterRequest f) => userRepo.GetAllAsync(f);
    public Task<List<UserDropdownDto>>    GetDropdownAsync()                => userRepo.GetDropdownAsync();

    public async Task<UserDetailDto> GetByIdAsync(int id)
        => await userRepo.GetByIdAsync(id) ?? throw new NotFoundException($"User {id} not found.");

    public async Task<UserDetailDto> CreateAsync(CreateUserDto dto, string createdBy)
    {
        Validate(dto);

        if (await userRepo.UsernameExistsAsync(dto.Username.Trim()))
            throw new ConflictException($"Username '{dto.Username}' is already taken.");

        // Verify role exists
        var role = await roleRepo.GetByIdAsync(dto.RoleId)
            ?? throw new ValidationException("Selected role does not exist.");

        var id = await userRepo.CreateAsync(new User
        {
            Username     = dto.Username.Trim().ToLower(),
            Password     = dto.Password,
            Name         = dto.Name.Trim(),
            Email        = dto.Email?.Trim().ToLower(),
            RoleId       = dto.RoleId,
            Role         = role.Name,
            CustomerName = dto.CustomerName?.Trim(),
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow,
            CreatedBy    = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<UserDetailDto> UpdateAsync(int id, UpdateUserDto dto, string updatedBy)
    {
        var existing = await GetByIdAsync(id);

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ValidationException("Name is required.");
        if (dto.RoleId <= 0)
            throw new ValidationException("Role is required.");

        var role = await roleRepo.GetByIdAsync(dto.RoleId)
            ?? throw new ValidationException("Selected role does not exist.");

        // Prevent demoting the last active admin
        if (existing.Role == "Admin" && role.Name != "Admin")
        {
            var adminCount = (await userRepo.GetAllAsync(new UserFilterRequest { Role = "Admin", IsActive = true })).Total;
            if (adminCount <= 1)
                throw new ValidationException("Cannot change the role of the last active Admin.");
        }

        await userRepo.UpdateAsync(new User
        {
            Id           = id,
            Name         = dto.Name.Trim(),
            Email        = dto.Email?.Trim().ToLower(),
            RoleId       = dto.RoleId,
            Role         = role.Name,
            CustomerName = dto.CustomerName?.Trim(),
            IsActive     = dto.IsActive,
            UpdatedAt    = DateTime.UtcNow,
            UpdatedBy    = updatedBy
        });
        return await GetByIdAsync(id);
    }

    public async Task ResetPasswordAsync(int id, ResetPasswordDto dto, string updatedBy)
    {
        await GetByIdAsync(id); // ensure exists
        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            throw new ValidationException("New password cannot be empty.");
        await userRepo.UpdatePasswordAsync(id, dto.NewPassword, updatedBy);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        var user = await GetByIdAsync(id);

        if (user.Role == "Admin")
        {
            var adminCount = (await userRepo.GetAllAsync(new UserFilterRequest { Role = "Admin", IsActive = true })).Total;
            if (adminCount <= 1)
                throw new ValidationException("Cannot delete the last active Admin.");
        }

        await userRepo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(UserFilterRequest filter, string format)
    {
        var data    = await userRepo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Username", "Name", "Email", "Role", "Status", "Last Login", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Username, x.Name, x.Email ?? "", x.Role,
            x.IsActive ? "Active" : "Inactive",
            x.LastLoginAt?.ToString("dd-MM-yyyy HH:mm") ?? "Never",
            x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Users", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("User List", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("User List", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    private static void Validate(CreateUserDto dto)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(dto.Username)) errors.Add("Username is required.");
        if (string.IsNullOrWhiteSpace(dto.Password)) errors.Add("Password is required.");
        if (string.IsNullOrWhiteSpace(dto.Name))     errors.Add("Name is required.");
        if (dto.RoleId <= 0)                          errors.Add("Role is required.");
        if (errors.Count > 0) throw new ValidationException(errors);
    }
}
