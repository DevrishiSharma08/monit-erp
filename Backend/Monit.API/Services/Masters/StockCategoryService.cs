using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class StockCategoryService(
    IStockCategoryRepository repo,
    IExportService           exportService,
    AppConfig                appConfig) : IStockCategoryService
{
    public Task<PagedResult<StockCategoryListDto>> GetAllAsync(StockCategoryFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<StockCategoryDropdownDto>> GetDropdownAsync(int? stockGroupId = null)    => repo.GetDropdownAsync(stockGroupId);

    public async Task<StockCategoryDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Stock Category {id} not found.");

    public async Task<StockCategoryDetailDto> CreateAsync(CreateStockCategoryDto dto, string createdBy)
    {
        Validate(dto);
        var (code, name) = GenerateCodeName(dto);
        if (await repo.CodeExistsAsync(code))
            throw new ConflictException($"GSM category '{name}' already exists.");

        var id = await repo.CreateAsync(new StockCategory
        {
            Code      = code,
            Name      = name,
            GsmType   = dto.GsmType,
            Gsm       = dto.Gsm,
            GsmMin    = dto.GsmMin,
            GsmMax    = dto.GsmMax,
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<StockCategoryDetailDto> UpdateAsync(int id, UpdateStockCategoryDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        Validate(dto);
        var (code, name) = GenerateCodeName(dto);
        if (await repo.CodeExistsAsync(code, id))
            throw new ConflictException($"GSM category '{name}' is already used by another record.");

        await repo.UpdateAsync(new StockCategory
        {
            Id        = id,
            Code      = code,
            Name      = name,
            GsmType   = dto.GsmType,
            Gsm       = dto.Gsm,
            GsmMin    = dto.GsmMin,
            GsmMax    = dto.GsmMax,
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

    public async Task<byte[]> ExportAsync(StockCategoryFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Label", "GSM Type", "GSM", "GSM Min", "GSM Max", "Status", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Name,
            x.GsmType,
            x.Gsm?.ToString() ?? "",
            x.GsmMin?.ToString() ?? "",
            x.GsmMax?.ToString() ?? "",
            x.IsActive ? "Active" : "Inactive",
            x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Stock Categories", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Stock Category Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Stock Category Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    private static (string code, string name) GenerateCodeName(CreateStockCategoryDto dto)
    {
        if (dto.GsmType == "range")
            return ($"{dto.GsmMin}-{dto.GsmMax}", $"{dto.GsmMin}-{dto.GsmMax} GSM");
        return ($"{dto.Gsm}", $"{dto.Gsm} GSM");
    }

    public async Task<List<StockCategoryDetailDto>> BulkCreateAsync(BulkCreateGsmDto dto, string createdBy)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ValidationException("At least one GSM value is required.");

        var entities = new List<StockCategory>();
        foreach (var item in dto.Items)
        {
            Validate(item);
            var (code, name) = GenerateCodeName(item);
            if (await repo.CodeExistsAsync(code))
                continue; // skip duplicates silently in bulk mode
            entities.Add(new StockCategory
            {
                Code      = code,
                Name      = name,
                GsmType   = item.GsmType,
                Gsm       = item.Gsm,
                GsmMin    = item.GsmMin,
                GsmMax    = item.GsmMax,
                IsActive  = true,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = createdBy
            });
        }
        if (entities.Count == 0)
            throw new ConflictException("All provided GSM values already exist.");

        return await repo.BulkCreateAsync(entities);
    }

    private static void Validate(CreateStockCategoryDto dto)
    {
        var errors = new List<string>();
        if (dto.GsmType != "single" && dto.GsmType != "range")
            errors.Add("GSM Type must be 'single' or 'range'.");
        if (dto.GsmType == "single" && dto.Gsm == null)
            errors.Add("GSM value is required for single type.");
        if (dto.GsmType == "range" && (dto.GsmMin == null || dto.GsmMax == null))
            errors.Add("GSM Min and Max are required for range type.");
        if (dto.GsmType == "range" && dto.GsmMin >= dto.GsmMax)
            errors.Add("GSM Min must be less than GSM Max.");
        if (errors.Count > 0) throw new ValidationException(errors);
    }
}
