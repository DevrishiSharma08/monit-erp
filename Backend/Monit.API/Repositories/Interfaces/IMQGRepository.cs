using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IMQGRepository
{
    Task<PagedResult<MQGListDto>>  GetAllAsync(MQGFilterRequest filter);
    Task<MQGDetailDto?>            GetByIdAsync(int id);
    Task<bool>                     ComboExistsAsync(int millId, int qualityId, int gsmMin, int gsmMax, string type, int? excludeId = null);
    Task<int?>                     GetIdByComboAsync(int millId, int qualityId, int gsmMin, int gsmMax, string type);
    Task<(string MillCode, string QualityName)> GetCodePartsAsync(int millId, int qualityId);
    Task<int>                      CreateAsync(MillQualityGsm entity);
    Task                           UpdateAsync(MillQualityGsm entity);
    Task                           SoftDeleteAsync(int id, string deletedBy);
    Task<List<MQGDropdownDto>>     GetDropdownAsync();
}
