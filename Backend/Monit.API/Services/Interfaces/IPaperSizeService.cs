using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IPaperSizeService
{
    Task<PagedResult<PaperSizeListDto>>  GetAllAsync(PaperSizeFilterRequest filter);
    Task<PaperSizeDetailDto>             GetByIdAsync(int id);
    Task<List<PaperSizeDropdownDto>>     GetDropdownAsync();
    Task<PaperSizeDetailDto>             CreateAsync(CreatePaperSizeDto dto, string createdBy);
    Task<PaperSizeDetailDto>             UpdateAsync(int id, UpdatePaperSizeDto dto, string updatedBy);
    Task                                 DeleteAsync(int id, string deletedBy);
    Task<byte[]>                         ExportAsync(PaperSizeFilterRequest filter, string format);
}
