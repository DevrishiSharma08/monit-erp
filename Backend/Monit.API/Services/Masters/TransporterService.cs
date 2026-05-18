using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class TransporterService(
    ITransporterRepository repo,
    IExportService         exportService,
    AppConfig              appConfig) : ITransporterService
{
    public Task<PagedResult<TransporterListDto>> GetAllAsync(TransporterFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<TransporterDropdownDto>>    GetDropdownAsync()                       => repo.GetDropdownAsync();

    public async Task<TransporterDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Transporter {id} not found.");

    public async Task<TransporterDetailDto> CreateAsync(CreateTransporterDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");

        var vehicles = dto.Vehicles.Select(v => MapVehicle(v)).ToList();
        var id = await repo.CreateAsync(new Transporter
        {
            Name       = dto.Name.Trim(),
            Phone      = dto.Phone?.Trim(),
            Email      = dto.Email?.Trim().ToLower(),
            Address    = dto.Address?.Trim(),
            GstNo      = dto.GstNo?.Trim().ToUpper(),
            PanNo      = dto.PanNo?.Trim().ToUpper(),
            TdsPercent = dto.TdsPercent,
            IsActive   = true,
            CreatedAt  = DateTime.UtcNow,
            CreatedBy  = createdBy
        }, vehicles, createdBy);
        return await GetByIdAsync(id);
    }

    public async Task<TransporterDetailDto> UpdateAsync(int id, UpdateTransporterDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");

        var vehicles = dto.Vehicles.Select(v => MapVehicle(v)).ToList();
        await repo.UpdateAsync(new Transporter
        {
            Id         = id,
            Name       = dto.Name.Trim(),
            Phone      = dto.Phone?.Trim(),
            Email      = dto.Email?.Trim().ToLower(),
            Address    = dto.Address?.Trim(),
            GstNo      = dto.GstNo?.Trim().ToUpper(),
            PanNo      = dto.PanNo?.Trim().ToUpper(),
            TdsPercent = dto.TdsPercent,
            IsActive   = dto.IsActive,
            UpdatedAt  = DateTime.UtcNow,
            UpdatedBy  = updatedBy
        }, vehicles, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(TransporterFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Name", "Phone", "Email", "Vehicles", "Status" };
        var rows    = data.Select(x => new List<string>
        {
            x.Name, x.Phone ?? "", x.Email ?? "", x.VehicleCount.ToString(),
            x.IsActive ? "Active" : "Inactive"
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Transporters", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Transporter Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Transporter Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    private static TransporterVehicle MapVehicle(UpsertTransporterVehicleDto v) => new()
    {
        VehicleType  = v.VehicleType.Trim(),
        Capacity     = v.Capacity,
        CapacityUnit = v.CapacityUnit?.Trim(),
        FreightRate  = v.FreightRate,
        IsActive     = true
    };
}
