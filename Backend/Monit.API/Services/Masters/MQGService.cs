using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class MQGService(IMQGRepository repo) : IMQGService
{
    public Task<PagedResult<MQGListDto>> GetAllAsync(MQGFilterRequest filter) => repo.GetAllAsync(filter);
    public Task<List<MQGDropdownDto>>    GetDropdownAsync()                    => repo.GetDropdownAsync();

    public async Task<MQGDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"MQG entry {id} not found.");

    public async Task<MQGDetailDto> CreateAsync(CreateMQGDto dto, string createdBy)
    {
        if (dto.MillId <= 0)    throw new ValidationException("Mill is required.");
        if (dto.QualityId <= 0) throw new ValidationException("Quality is required.");
        if (dto.GsmMin <= 0)    throw new ValidationException("GSM Min must be greater than 0.");
        if (dto.GsmMax < dto.GsmMin) throw new ValidationException("GSM Max must be >= GSM Min.");
        if (string.IsNullOrWhiteSpace(dto.Type)) throw new ValidationException("Type is required.");

        if (await repo.ComboExistsAsync(dto.MillId, dto.QualityId, dto.GsmMin, dto.GsmMax, dto.Type))
            throw new ConflictException("This Mill + Quality + GSM Range + Type combination already exists.");

        var (millCode, qualityName) = await repo.GetCodePartsAsync(dto.MillId, dto.QualityId);
        var code = BuildCode(millCode, qualityName, dto.GsmMin, dto.GsmMax, dto.Type);

        var id = await repo.CreateAsync(new MillQualityGsm
        {
            Code      = code,
            MillId    = dto.MillId,
            QualityId = dto.QualityId,
            GsmMin    = dto.GsmMin,
            GsmMax    = dto.GsmMax,
            Type      = dto.Type.Trim(),
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<MQGDetailDto> UpdateAsync(int id, UpdateMQGDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        if (dto.MillId <= 0)    throw new ValidationException("Mill is required.");
        if (dto.QualityId <= 0) throw new ValidationException("Quality is required.");
        if (dto.GsmMin <= 0)    throw new ValidationException("GSM Min must be greater than 0.");
        if (dto.GsmMax < dto.GsmMin) throw new ValidationException("GSM Max must be >= GSM Min.");
        if (string.IsNullOrWhiteSpace(dto.Type)) throw new ValidationException("Type is required.");

        if (await repo.ComboExistsAsync(dto.MillId, dto.QualityId, dto.GsmMin, dto.GsmMax, dto.Type, id))
            throw new ConflictException("This Mill + Quality + GSM Range + Type combination already exists.");

        var (millCode, qualityName) = await repo.GetCodePartsAsync(dto.MillId, dto.QualityId);
        var code = BuildCode(millCode, qualityName, dto.GsmMin, dto.GsmMax, dto.Type);

        await repo.UpdateAsync(new MillQualityGsm
        {
            Id        = id,
            Code      = code,
            MillId    = dto.MillId,
            QualityId = dto.QualityId,
            GsmMin    = dto.GsmMin,
            GsmMax    = dto.GsmMax,
            Type      = dto.Type.Trim(),
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

    private static string BuildCode(string millCode, string qualityName, int gsmMin, int gsmMax, string type)
    {
        var q = qualityName.Replace(" ", "").Replace("-", "").ToUpperInvariant();
        return $"{millCode.ToUpperInvariant()}-{q}-{gsmMin}-{gsmMax}-{type.ToUpperInvariant()}";
    }
}
