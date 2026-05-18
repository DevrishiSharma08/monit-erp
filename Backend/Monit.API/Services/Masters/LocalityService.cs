using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class LocalityService(
    ILocalityRepository repo,
    IExportService      exportService,
    AppConfig           appConfig) : ILocalityService
{
    public Task<PagedResult<LocalityListDto>> GetAllAsync(LocalityFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<LocalityDropdownDto>>    GetDropdownAsync()                    => repo.GetDropdownAsync();

    public async Task<LocalityDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Locality {id} not found.");

    public async Task<LocalityDetailDto> CreateAsync(CreateLocalityDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        var id = await repo.CreateAsync(new Locality
        {
            Name        = dto.Name.Trim(),
            City        = dto.City?.Trim(),
            State       = dto.State?.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = true,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = createdBy,
        });
        return await GetByIdAsync(id);
    }

    public async Task<LocalityDetailDto> UpdateAsync(int id, UpdateLocalityDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        await repo.UpdateAsync(new Locality
        {
            Id          = id,
            Name        = dto.Name.Trim(),
            City        = dto.City?.Trim(),
            State       = dto.State?.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = dto.IsActive,
            UpdatedAt   = DateTime.UtcNow,
            UpdatedBy   = updatedBy,
        });
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(LocalityFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Name", "City", "State", "Description", "Status", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Name, x.City ?? "", x.State ?? "", x.Description ?? "",
            x.IsActive ? "Active" : "Inactive",
            x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Localities", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Locality Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Locality Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }
}
