using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class HsnCodeService(IHsnCodeRepository repo) : IHsnCodeService
{
    public Task<PagedResult<HsnCodeListDto>> GetAllAsync(HsnCodeFilterRequest filter) => repo.GetAllAsync(filter);
    public Task<List<HsnCodeDropdownDto>>    GetDropdownAsync()                        => repo.GetDropdownAsync();

    public async Task<HsnCodeDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"HSN Code {id} not found.");

    public async Task<HsnCodeDetailDto> CreateAsync(CreateHsnCodeDto dto, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Code)) throw new ValidationException("HSN Code is required.");
        if (dto.GstPercent < 0)                  throw new ValidationException("GST % cannot be negative.");
        if (await repo.CodeExistsAsync(dto.Code.Trim()))
            throw new ConflictException($"HSN Code '{dto.Code}' already exists.");

        var id = await repo.CreateAsync(new HsnCode
        {
            Code        = dto.Code.Trim().ToUpper(),
            Description = dto.Description?.Trim(),
            GstPercent  = dto.GstPercent,
            IsActive    = true,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<HsnCodeDetailDto> UpdateAsync(int id, UpdateHsnCodeDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (string.IsNullOrWhiteSpace(dto.Code)) throw new ValidationException("HSN Code is required.");
        if (dto.GstPercent < 0)                  throw new ValidationException("GST % cannot be negative.");
        if (await repo.CodeExistsAsync(dto.Code.Trim(), id))
            throw new ConflictException($"HSN Code '{dto.Code}' is already used by another record.");

        await repo.UpdateAsync(new HsnCode
        {
            Id          = id,
            Code        = dto.Code.Trim().ToUpper(),
            Description = dto.Description?.Trim(),
            GstPercent  = dto.GstPercent,
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
