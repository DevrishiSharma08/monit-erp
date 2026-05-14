using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IMaterialService
{
    Task<PagedResult<MaterialListDto>>  GetAllAsync(MaterialFilterRequest filter);
    Task<MaterialDetailDto>             GetByIdAsync(int id);
    Task<List<MaterialDropdownDto>>     GetDropdownAsync(int? millId = null, int? qualityId = null);
    Task<MaterialDetailDto>             CreateAsync(CreateMaterialDto dto, string createdBy);
    Task<MaterialDetailDto>             UpdateAsync(int id, UpdateMaterialDto dto, string updatedBy);
    Task                                DeleteAsync(int id, string deletedBy);
    Task<byte[]>                        ExportAsync(MaterialFilterRequest filter, string format);
}
