using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface ITransporterRepository
{
    Task<PagedResult<TransporterListDto>>  GetAllAsync(TransporterFilterRequest filter);
    Task<List<TransporterListDto>>         GetAllForExportAsync(TransporterFilterRequest filter);
    Task<TransporterDetailDto?>            GetByIdAsync(int id);
    Task<List<TransporterDropdownDto>>     GetDropdownAsync();
    Task<int>                              CreateAsync(Transporter transporter, IEnumerable<TransporterVehicle> vehicles, string createdBy);
    Task                                   UpdateAsync(Transporter transporter, IEnumerable<TransporterVehicle> vehicles, string updatedBy);
    Task                                   SoftDeleteAsync(int id, string deletedBy);
}
