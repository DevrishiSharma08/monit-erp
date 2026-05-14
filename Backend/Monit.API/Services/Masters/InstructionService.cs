using System.Text.Json;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class InstructionService(
    IInstructionRepository repo,
    IExportService         exportService,
    AppConfig              appConfig) : IInstructionService
{
    public Task<PagedResult<InstructionListDto>> GetAllAsync(InstructionFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<InstructionDropdownDto>>    GetDropdownAsync()                       => repo.GetDropdownAsync();
    public Task<List<InstructionDropdownDto>>    GetByMillAsync(int? millId)              => repo.GetByMillAsync(millId);

    public async Task<InstructionDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Instruction {id} not found.");

    public async Task<InstructionDetailDto> CreateAsync(CreateInstructionDto dto, string createdBy)
    {
        if (dto.Lines is null || dto.Lines.Count == 0 || dto.Lines.All(l => string.IsNullOrWhiteSpace(l)))
            throw new ValidationException("At least one instruction line is required.");
        if (dto.ApplicableTo == "Specific" && (dto.MillIds is null || dto.MillIds.Count == 0))
            throw new ValidationException("At least one mill must be selected for specific instructions.");

        var cleanLines = dto.Lines.Where(l => !string.IsNullOrWhiteSpace(l)).Select(l => l.Trim()).ToList();
        var millIds    = dto.ApplicableTo == "All" ? [] : dto.MillIds ?? [];

        var id = await repo.CreateAsync(new Instruction
        {
            Title        = dto.Title?.Trim(),
            ApplicableTo = dto.ApplicableTo,
            LinesJson    = JsonSerializer.Serialize(cleanLines),
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow,
            CreatedBy    = createdBy,
        }, millIds);
        return await GetByIdAsync(id);
    }

    public async Task<InstructionDetailDto> UpdateAsync(int id, UpdateInstructionDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (dto.Lines is null || dto.Lines.Count == 0 || dto.Lines.All(l => string.IsNullOrWhiteSpace(l)))
            throw new ValidationException("At least one instruction line is required.");
        if (dto.ApplicableTo == "Specific" && (dto.MillIds is null || dto.MillIds.Count == 0))
            throw new ValidationException("At least one mill must be selected for specific instructions.");

        var cleanLines = dto.Lines.Where(l => !string.IsNullOrWhiteSpace(l)).Select(l => l.Trim()).ToList();
        var millIds    = dto.ApplicableTo == "All" ? [] : dto.MillIds ?? [];

        await repo.UpdateAsync(new Instruction
        {
            Id           = id,
            Title        = dto.Title?.Trim(),
            ApplicableTo = dto.ApplicableTo,
            LinesJson    = JsonSerializer.Serialize(cleanLines),
            IsActive     = dto.IsActive,
            UpdatedAt    = DateTime.UtcNow,
            UpdatedBy    = updatedBy,
        }, millIds);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(InstructionFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Title", "Applicable To", "Mills", "Lines Count", "Status", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Title ?? "(Untitled)",
            x.ApplicableTo,
            x.ApplicableTo == "All" ? "All Mills" : $"{x.MillIds.Count} mill(s)",
            x.Lines.Count.ToString(),
            x.IsActive ? "Active" : "Inactive",
            x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Instructions", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Instruction Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Instruction Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }
}
