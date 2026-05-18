using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class PaperSizeService(
    IPaperSizeRepository repo,
    IExportService       exportService,
    AppConfig            appConfig) : IPaperSizeService
{
    public Task<PagedResult<PaperSizeListDto>> GetAllAsync(PaperSizeFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<PaperSizeDropdownDto>>    GetDropdownAsync()                     => repo.GetDropdownAsync();

    public async Task<PaperSizeDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Paper Size {id} not found.");

    public async Task<PaperSizeDetailDto> CreateAsync(CreatePaperSizeDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Label)) throw new ValidationException("Label is required.");
        if (await repo.LabelExistsAsync(dto.Label.Trim()))
            throw new ConflictException($"Paper Size label '{dto.Label}' already exists.");

        var id = await repo.CreateAsync(new PaperSize
        {
            Label     = dto.Label.Trim(),
            WidthMM   = dto.WidthMM,
            HeightMM  = dto.HeightMM,
            IsCustom  = dto.IsCustom,
            SortOrder = dto.SortOrder,
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<PaperSizeDetailDto> UpdateAsync(int id, UpdatePaperSizeDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Label)) throw new ValidationException("Label is required.");
        if (await repo.LabelExistsAsync(dto.Label.Trim(), id))
            throw new ConflictException($"Paper Size label '{dto.Label}' is already used.");

        await repo.UpdateAsync(new PaperSize
        {
            Id        = id,
            Label     = dto.Label.Trim(),
            WidthMM   = dto.WidthMM,
            HeightMM  = dto.HeightMM,
            IsCustom  = dto.IsCustom,
            SortOrder = dto.SortOrder,
            IsActive  = dto.IsActive,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy
        });
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(PaperSizeFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Label", "Width (mm)", "Height (mm)", "Custom", "Sort Order", "Status" };
        var rows    = data.Select(x => new List<string>
        {
            x.Label,
            x.WidthMM?.ToString()  ?? "",
            x.HeightMM?.ToString() ?? "",
            x.IsCustom ? "Yes" : "No",
            x.SortOrder.ToString(),
            x.IsActive ? "Active" : "Inactive"
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Paper Sizes", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Paper Size Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Paper Size Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }
}
