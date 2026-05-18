using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class StockGroupService(
    IStockGroupRepository repo,
    IExportService        exportService,
    AppConfig             appConfig) : IStockGroupService
{
    public Task<PagedResult<StockGroupListDto>> GetAllAsync(StockGroupFilterRequest f)  => repo.GetAllAsync(f);
    public Task<List<StockGroupDropdownDto>>    GetDropdownAsync()                       => repo.GetDropdownAsync();
    public Task<List<SubGroupDropdownDto>>      GetSubGroupsDropdownAsync()              => repo.GetSubGroupsDropdownAsync();

    public async Task<StockGroupDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Quality Group {id} not found.");

    public async Task<StockGroupDetailDto> CreateAsync(CreateStockGroupDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        if (await repo.NameExistsAsync(dto.Name.Trim()))
            throw new ConflictException($"Quality Group '{dto.Name}' already exists.");

        var id = await repo.CreateAsync(new StockGroup
        {
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = true,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = createdBy
        }, dto.Subgroups);

        return await GetByIdAsync(id);
    }

    public async Task<StockGroupDetailDto> UpdateAsync(int id, UpdateStockGroupDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        if (await repo.NameExistsAsync(dto.Name.Trim(), id))
            throw new ConflictException($"Quality Group '{dto.Name}' is already used by another group.");

        await repo.UpdateAsync(new StockGroup
        {
            Id          = id,
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = dto.IsActive,
            UpdatedAt   = DateTime.UtcNow,
            UpdatedBy   = updatedBy
        }, dto.Subgroups);

        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(StockGroupFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Name", "Qualities", "Description", "Status", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Name,
            string.Join(", ", x.Subgroups.Select(s => s.Alias != null ? $"{s.Alias} ({s.Name})" : s.Name)),
            x.Description ?? "",
            x.IsActive ? "Active" : "Inactive",
            x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Quality Groups", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Quality Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Quality Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }
}
