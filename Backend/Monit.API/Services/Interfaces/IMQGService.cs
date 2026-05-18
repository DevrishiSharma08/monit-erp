using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IMQGService
{
    Task<PagedResult<MQGListDto>> GetAllAsync(MQGFilterRequest filter);
    Task<MQGDetailDto>            GetByIdAsync(int id);
    Task<List<MQGDropdownDto>>    GetDropdownAsync();
    Task<MQGDetailDto>            CreateAsync(CreateMQGDto dto, string createdBy);
    Task<MQGDetailDto>            UpdateAsync(int id, UpdateMQGDto dto, string updatedBy);
    Task                          DeleteAsync(int id, string deletedBy);
}
