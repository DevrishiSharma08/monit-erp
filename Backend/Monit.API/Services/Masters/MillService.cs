using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class MillService(
    IMillRepository millRepo,
    IExportService  exportService,
    AppConfig       appConfig) : IMillService
{
    public Task<PagedResult<MillListDto>> GetAllAsync(MillFilterRequest filter) => millRepo.GetAllAsync(filter);
    public Task<List<MillDropdownDto>>    GetDropdownAsync()                     => millRepo.GetDropdownAsync();

    public async Task<MillDetailDto> GetByIdAsync(int id)
        => await millRepo.GetByIdAsync(id) ?? throw new NotFoundException($"Mill {id} not found.");

    public async Task<MillDetailDto> CreateAsync(CreateMillDto dto, string createdBy)
    {
        Validate(dto);
        if (await millRepo.CodeExistsAsync(dto.Code))
            throw new ConflictException($"Mill code '{dto.Code}' already exists.");

        var mill = new Mill
        {
            Code         = dto.Code.Trim().ToUpper(),
            Name         = dto.Name.Trim(),
            OwnerName    = dto.OwnerName?.Trim(),
            Phone        = dto.Phone?.Trim(),
            Email        = dto.Email?.Trim().ToLower(),
            GstNo        = dto.GstNo?.Trim().ToUpper(),
            PaymentTerms = dto.PaymentTerms?.Trim(),
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow,
            CreatedBy    = createdBy
        };

        var id = await millRepo.CreateAsync(mill, dto.Units, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<MillDetailDto> UpdateAsync(int id, UpdateMillDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        Validate(dto);
        if (await millRepo.CodeExistsAsync(dto.Code, id))
            throw new ConflictException($"Mill code '{dto.Code}' is already used by another mill.");

        var mill = new Mill
        {
            Id           = id,
            Code         = dto.Code.Trim().ToUpper(),
            Name         = dto.Name.Trim(),
            OwnerName    = dto.OwnerName?.Trim(),
            Phone        = dto.Phone?.Trim(),
            Email        = dto.Email?.Trim().ToLower(),
            GstNo        = dto.GstNo?.Trim().ToUpper(),
            PaymentTerms = dto.PaymentTerms?.Trim(),
            IsActive     = dto.IsActive,
            UpdatedAt    = DateTime.UtcNow,
            UpdatedBy    = updatedBy
        };

        await millRepo.UpdateAsync(mill, dto.Units, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await millRepo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(MillFilterRequest filter, string format)
    {
        var data    = await millRepo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Code", "Name", "Owner Name", "Phone", "Email", "GST No.", "Payment Terms", "Units", "Status", "Created At" };
        var rows    = data.Select(m => new List<string>
        {
            m.Code, m.Name,
            m.OwnerName ?? "", m.Phone ?? "", m.Email ?? "",
            m.GstNo ?? "", m.PaymentTerms ?? "",
            m.UnitCount.ToString(),
            m.IsActive ? "Active" : "Inactive",
            m.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Mills", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Mill Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Mill Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    private static void Validate(CreateMillDto dto)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(dto.Code)) errors.Add("Code is required.");
        if (string.IsNullOrWhiteSpace(dto.Name)) errors.Add("Name is required.");
        if (dto.Code?.Length > 20) errors.Add("Code must be 20 characters or less.");
        if (errors.Count > 0) throw new ValidationException(errors);
    }
}
