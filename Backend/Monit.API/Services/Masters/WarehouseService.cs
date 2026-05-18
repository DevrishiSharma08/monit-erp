using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class WarehouseService(
    IWarehouseRepository repo,
    IExportService       exportService,
    AppConfig            appConfig) : IWarehouseService
{
    public Task<PagedResult<WarehouseListDto>> GetAllAsync(WarehouseFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<WarehouseDropdownDto>>    GetDropdownAsync()                     => repo.GetDropdownAsync();

    public async Task<WarehouseDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Warehouse {id} not found.");

    public async Task<WarehouseDetailDto> CreateAsync(CreateWarehouseDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Unit)) throw new ValidationException("Unit is required.");
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");

        var bins = MapBins(dto.Bins);
        var id   = await repo.CreateAsync(new Warehouse
        {
            Unit      = dto.Unit.Trim(),
            Name      = dto.Name.Trim(),
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        }, bins, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<WarehouseDetailDto> UpdateAsync(int id, UpdateWarehouseDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Unit)) throw new ValidationException("Unit is required.");
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");

        var bins = MapBins(dto.Bins);
        await repo.UpdateAsync(new Warehouse
        {
            Id        = id,
            Unit      = dto.Unit.Trim(),
            Name      = dto.Name.Trim(),
            IsActive  = dto.IsActive,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy
        }, bins, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(WarehouseFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Unit", "Name", "Bins", "Racks", "Status" };
        var rows    = data.Select(x => new List<string>
        {
            x.Unit, x.Name, x.BinCount.ToString(), x.RackCount.ToString(),
            x.IsActive ? "Active" : "Inactive"
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Warehouses", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Warehouse Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Warehouse Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    private static IEnumerable<(WarehouseBin bin, IEnumerable<WarehouseRack> racks)> MapBins(IEnumerable<UpsertWarehouseBinDto> binDtos)
        => binDtos.Select(b => (
            new WarehouseBin { Name = b.Name.Trim(), IsActive = b.IsActive },
            b.Racks.Select(r => new WarehouseRack { Name = r.Name.Trim(), StackCount = r.StackCount, IsActive = r.IsActive }).AsEnumerable()
        ));
}
