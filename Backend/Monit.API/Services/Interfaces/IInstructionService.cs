using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IInstructionService
{
    Task<PagedResult<InstructionListDto>>   GetAllAsync(InstructionFilterRequest filter);
    Task<InstructionDetailDto>              GetByIdAsync(int id);
    Task<List<InstructionDropdownDto>>      GetDropdownAsync();
    Task<List<InstructionDropdownDto>>      GetByMillAsync(int? millId);
    Task<InstructionDetailDto>              CreateAsync(CreateInstructionDto dto, string createdBy);
    Task<InstructionDetailDto>              UpdateAsync(int id, UpdateInstructionDto dto, string updatedBy);
    Task                                    DeleteAsync(int id, string deletedBy);
    Task<byte[]>                            ExportAsync(InstructionFilterRequest filter, string format);
}
