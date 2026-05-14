using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class UnitService(IUnitRepository repo) : IUnitService
{
    public Task<PagedResult<UnitListDto>> GetAllAsync(UnitFilterRequest filter) => repo.GetAllAsync(filter);
    public Task<List<UnitDropdownDto>>    GetDropdownAsync()                     => repo.GetDropdownAsync();

    public async Task<UnitDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Unit {id} not found.");

    public async Task<UnitDetailDto> CreateAsync(CreateUnitDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        if (await repo.NameExistsAsync(dto.Name.Trim()))
            throw new ConflictException($"Unit '{dto.Name}' already exists.");

        var id = await repo.CreateAsync(new Unit
        {
            Name        = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive    = true,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<UnitDetailDto> UpdateAsync(int id, UpdateUnitDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationException("Name is required.");
        if (await repo.NameExistsAsync(dto.Name.Trim(), id))
            throw new ConflictException($"Unit '{dto.Name}' is already used by another record.");

        await repo.UpdateAsync(new Unit
        {
            Id          = id,
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
}
