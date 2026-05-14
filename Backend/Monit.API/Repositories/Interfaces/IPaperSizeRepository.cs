using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IPaperSizeRepository
{
    Task<PagedResult<PaperSizeListDto>>  GetAllAsync(PaperSizeFilterRequest filter);
    Task<List<PaperSizeListDto>>         GetAllForExportAsync(PaperSizeFilterRequest filter);
    Task<PaperSizeDetailDto?>            GetByIdAsync(int id);
    Task<List<PaperSizeDropdownDto>>     GetDropdownAsync();
    Task<bool>                           LabelExistsAsync(string label, int? excludeId = null);
    Task<int>                            CreateAsync(PaperSize entity);
    Task                                 UpdateAsync(PaperSize entity);
    Task                                 SoftDeleteAsync(int id, string deletedBy);
}
