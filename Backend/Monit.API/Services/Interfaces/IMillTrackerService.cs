using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Services.Interfaces;

public interface IMillTrackerService
{
    Task<PagedResult<MillTrackerListDto>> GetAllAsync(MillTrackerFilterRequest filter);
    Task<MillTrackerListDto>              GetByIdAsync(int id);
    Task<List<MillTrackerListDto>>        GetByPoIdAsync(int poId);
    Task<MillTrackerListDto>              UpdateStatusAsync(int id, UpdateMillTrackerStatusDto dto, string updatedBy);
    Task<MillTrackerBatchDto>             AddBatchAsync(int id, AddMillTrackerBatchDto batch, string createdBy);
    Task<BulkImportResultDto>             BulkImportAsync(List<BulkImportRowDto> rows, string updatedBy);
    Task                                  DeleteAsync(int id, string deletedBy);
}
