using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class ItemTypeService(
    IItemTypeRepository repo,
    IExportService      exportService,
    AppConfig           appConfig) : IItemTypeService
{
    public Task<PagedResult<ItemTypeListDto>> GetAllAsync(ItemTypeFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<ItemTypeDropdownDto>>    GetDropdownAsync()                    => repo.GetDropdownAsync();

    public async Task<ItemTypeDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Item Type {id} not found.");

    public async Task<ItemTypeDetailDto> CreateAsync(CreateItemTypeDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        var code = string.IsNullOrWhiteSpace(dto.Code)
            ? dto.Name.Trim().ToUpperInvariant().Replace(" ", "_")
            : dto.Code.Trim().ToUpperInvariant();
        if (await repo.CodeExistsAsync(code))
            throw new ConflictException($"Item Type code '{code}' already exists.");

        var id = await repo.CreateAsync(new ItemType
        {
            Code        = code,
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = true,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<ItemTypeDetailDto> UpdateAsync(int id, UpdateItemTypeDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        var code = string.IsNullOrWhiteSpace(dto.Code)
            ? dto.Name.Trim().ToUpperInvariant().Replace(" ", "_")
            : dto.Code.Trim().ToUpperInvariant();
        if (await repo.CodeExistsAsync(code, id))
            throw new ConflictException($"Item Type code '{code}' is already used.");

        await repo.UpdateAsync(new ItemType
        {
            Id          = id,
            Code        = code,
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = dto.IsActive,
            UpdatedAt   = DateTime.UtcNow,
            UpdatedBy   = updatedBy
        });
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(ItemTypeFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Code", "Name", "Description", "Status", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Code, x.Name, x.Description ?? "", x.IsActive ? "Active" : "Inactive",
            x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Item Types", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Item Type Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Item Type Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }
}
