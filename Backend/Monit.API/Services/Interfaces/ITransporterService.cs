using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface ITransporterService
{
    Task<PagedResult<TransporterListDto>>  GetAllAsync(TransporterFilterRequest filter);
    Task<TransporterDetailDto>             GetByIdAsync(int id);
    Task<List<TransporterDropdownDto>>     GetDropdownAsync();
    Task<TransporterDetailDto>             CreateAsync(CreateTransporterDto dto, string createdBy);
    Task<TransporterDetailDto>             UpdateAsync(int id, UpdateTransporterDto dto, string updatedBy);
    Task                                   DeleteAsync(int id, string deletedBy);
    Task<byte[]>                           ExportAsync(TransporterFilterRequest filter, string format);
}
