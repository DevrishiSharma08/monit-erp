using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Auth;
using Monit.API.Models.Entities.Auth;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Auth;

public class UserManagementService(
    IUserRepository      userRepo,
    IRoleRepository      roleRepo,
    IExportService       exportService,
    AppConfig            appConfig,
    IHttpContextAccessor http) : IUserManagementService
{
    private int  CurrentCompanyId  => int.TryParse(http.HttpContext?.User?.FindFirst("company_id")?.Value, out var id) ? id : 1;
    private static int OtherCompany(int current) => current == 1 ? 2 : 1;
    public Task<PagedResult<UserListDto>> GetAllAsync(UserFilterRequest f) => userRepo.GetAllAsync(f);
    public Task<List<UserDropdownDto>>    GetDropdownAsync()                => userRepo.GetDropdownAsync();

    public async Task<UserDetailDto> GetByIdAsync(int id)
        => await userRepo.GetByIdAsync(id) ?? throw new NotFoundException($"User {id} not found.");

    public async Task<UserDetailDto> CreateAsync(CreateUserDto dto, string createdBy)
    {
        Validate(dto);

        if (await userRepo.UsernameExistsAsync(dto.Username.Trim()))
            throw new ConflictException($"Username '{dto.Username}' is already taken.");

        var role = await roleRepo.GetByIdAsync(dto.RoleId)
            ?? throw new ValidationException("Selected role does not exist.");

        var user = new User
        {
            Username            = dto.Username.Trim().ToLower(),
            Password            = dto.Password,
            Name                = dto.Name.Trim(),
            Email               = dto.Email?.Trim().ToLower(),
            RoleId              = dto.RoleId,
            Role                = role.Name,
            CustomerName        = dto.CustomerName?.Trim(),
            IsActive            = true,
            BothCompaniesAccess = dto.BothCompaniesAccess,
            CreatedAt           = DateTime.UtcNow,
            CreatedBy           = createdBy,
            UpdatedAt           = DateTime.UtcNow,
            UpdatedBy           = createdBy,
        };

        var id = await userRepo.CreateAsync(user);

        if (dto.BothCompaniesAccess)
            await userRepo.UpsertByUsernameForCompanyAsync(user, OtherCompany(CurrentCompanyId));

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

        if (existing.Role == "Admin" && role.Name != "Admin")
        {
            var adminCount = (await userRepo.GetAllAsync(new UserFilterRequest { Role = "Admin", IsActive = true })).Total;
            if (adminCount <= 1)
                throw new ValidationException("Cannot change the role of the last active Admin.");
        }

        var user = new User
        {
            Id                  = id,
            Username            = existing.Username,
            Name                = dto.Name.Trim(),
            Email               = dto.Email?.Trim().ToLower(),
            RoleId              = dto.RoleId,
            Role                = role.Name,
            CustomerName        = dto.CustomerName?.Trim(),
            IsActive            = dto.IsActive,
            BothCompaniesAccess = dto.BothCompaniesAccess,
            UpdatedAt           = DateTime.UtcNow,
            UpdatedBy           = updatedBy
        };

        await userRepo.UpdateAsync(user);

        if (dto.BothCompaniesAccess)
        {
            user.Password = await userRepo.GetPasswordAsync(id) ?? "";
            await userRepo.UpsertByUsernameForCompanyAsync(user, OtherCompany(CurrentCompanyId));
        }

        return await GetByIdAsync(id);
    }

    public async Task ResetPasswordAsync(int id, ResetPasswordDto dto, string updatedBy)
    {
        var user = await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            throw new ValidationException("New password cannot be empty.");
        await userRepo.UpdatePasswordAsync(id, dto.NewPassword, updatedBy);
        if (user.BothCompaniesAccess)
            await userRepo.UpdatePasswordByUsernameForCompanyAsync(user.Username, dto.NewPassword, updatedBy, OtherCompany(CurrentCompanyId));
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
        if (user.BothCompaniesAccess)
            await userRepo.SoftDeleteByUsernameForCompanyAsync(user.Username, deletedBy, OtherCompany(CurrentCompanyId));
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
