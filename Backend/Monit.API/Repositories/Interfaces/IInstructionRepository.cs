using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IInstructionRepository
{
    Task<PagedResult<InstructionListDto>>   GetAllAsync(InstructionFilterRequest filter);
    Task<List<InstructionListDto>>          GetAllForExportAsync(InstructionFilterRequest filter);
    Task<InstructionDetailDto?>             GetByIdAsync(int id);
    Task<List<InstructionDropdownDto>>      GetDropdownAsync();
    Task<List<InstructionDropdownDto>>      GetByMillAsync(int? millId);
    Task<int>                               CreateAsync(Instruction entity, List<int> millIds);
    Task                                    UpdateAsync(Instruction entity, List<int> millIds);
    Task                                    SoftDeleteAsync(int id, string deletedBy);
}
