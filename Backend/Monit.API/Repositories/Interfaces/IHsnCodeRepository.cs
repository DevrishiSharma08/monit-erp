using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IHsnCodeRepository
{
    Task<PagedResult<HsnCodeListDto>> GetAllAsync(HsnCodeFilterRequest filter);
    Task<List<HsnCodeListDto>>        GetAllForExportAsync(HsnCodeFilterRequest filter);
    Task<HsnCodeDetailDto?>           GetByIdAsync(int id);
    Task<bool>                        CodeExistsAsync(string code, int? excludeId = null);
    Task<int>                         CreateAsync(HsnCode entity);
    Task                              UpdateAsync(HsnCode entity);
    Task                              SoftDeleteAsync(int id, string deletedBy);
    Task<List<HsnCodeDropdownDto>>    GetDropdownAsync();
}
