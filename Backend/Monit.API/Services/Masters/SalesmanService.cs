using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class SalesmanService(
    ISalesmanRepository repo,
    IExportService      exportService,
    AppConfig           appConfig) : ISalesmanService
{
    public Task<PagedResult<SalesmanListDto>> GetAllAsync(SalesmanFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<SalesmanDropdownDto>>    GetDropdownAsync()  => repo.GetDropdownAsync();
    public Task<List<SalesmanForSODto>>       GetForSOAsync()     => repo.GetForSOAsync();

    public async Task<SalesmanDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Salesman {id} not found.");

    public async Task<SalesmanDetailDto> CreateAsync(CreateSalesmanDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Code)) throw new ValidationException("Code is required.");
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        if (await repo.CodeExistsAsync(dto.Code.Trim().ToUpper()))
            throw new ConflictException($"Salesman code '{dto.Code}' already exists.");

        var id = await repo.CreateAsync(new Salesman
        {
            Code      = dto.Code.Trim().ToUpper(),
            Name      = dto.Name.Trim(),
            Phone     = dto.Phone?.Trim(),
            Email     = dto.Email?.Trim().ToLower(),
            Territory = dto.Territory?.Trim(),
            UserId    = dto.UserId,
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<SalesmanDetailDto> UpdateAsync(int id, UpdateSalesmanDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Code)) throw new ValidationException("Code is required.");
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        if (await repo.CodeExistsAsync(dto.Code.Trim().ToUpper(), id))
            throw new ConflictException($"Salesman code '{dto.Code}' is already used.");

        await repo.UpdateAsync(new Salesman
        {
            Id        = id,
            Code      = dto.Code.Trim().ToUpper(),
            Name      = dto.Name.Trim(),
            Phone     = dto.Phone?.Trim(),
            Email     = dto.Email?.Trim().ToLower(),
            Territory = dto.Territory?.Trim(),
            UserId    = dto.UserId,
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

    public async Task<byte[]> ExportAsync(SalesmanFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Code", "Name", "Phone", "Territory", "Status", "Created At" };
        var rows    = data.Select(x => new List<string>
        {
            x.Code, x.Name, x.Phone ?? "", x.Territory ?? "",
            x.IsActive ? "Active" : "Inactive", x.CreatedAt.ToString("dd-MM-yyyy")
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Salesmen", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Salesman Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Salesman Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }
}
