using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IMillService
{
    Task<PagedResult<MillListDto>> GetAllAsync(MillFilterRequest filter);
    Task<MillDetailDto>            GetByIdAsync(int id);
    Task<MillDetailDto>            CreateAsync(CreateMillDto dto, string createdBy);
    Task<MillDetailDto>            UpdateAsync(int id, UpdateMillDto dto, string updatedBy);
    Task                           DeleteAsync(int id, string deletedBy);
    Task<byte[]>                   ExportAsync(MillFilterRequest filter, string format);
    Task<List<MillDropdownDto>>    GetDropdownAsync();
    Task<List<MillContactDto>>     GetContactsAsync(int millId);
}
