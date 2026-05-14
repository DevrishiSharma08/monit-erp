using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IMaterialRepository
{
    Task<PagedResult<MaterialListDto>>  GetAllAsync(MaterialFilterRequest filter);
    Task<List<MaterialListDto>>         GetAllForExportAsync(MaterialFilterRequest filter);
    Task<MaterialDetailDto?>            GetByIdAsync(int id);
    Task<List<MaterialDropdownDto>>     GetDropdownAsync(int? millId = null, int? qualityId = null);
    Task<bool>                          CodeExistsAsync(string code, int? excludeId = null);
    Task<int>                           CreateAsync(Material entity);
    Task                                UpdateAsync(Material entity);
    Task                                SoftDeleteAsync(int id, string deletedBy);
    Task<(string millCode, string qualityName, string? qualityAlias, string typeName)?> GetCodePartsAsync(int millId, int qualityId, int itemTypeId);
}
