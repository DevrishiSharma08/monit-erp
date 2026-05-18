using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IHsnCodeService
{
    Task<PagedResult<HsnCodeListDto>> GetAllAsync(HsnCodeFilterRequest filter);
    Task<HsnCodeDetailDto>            GetByIdAsync(int id);
    Task<List<HsnCodeDropdownDto>>    GetDropdownAsync();
    Task<HsnCodeDetailDto>            CreateAsync(CreateHsnCodeDto dto, string createdBy);
    Task<HsnCodeDetailDto>            UpdateAsync(int id, UpdateHsnCodeDto dto, string updatedBy);
    Task                              DeleteAsync(int id, string deletedBy);
}
