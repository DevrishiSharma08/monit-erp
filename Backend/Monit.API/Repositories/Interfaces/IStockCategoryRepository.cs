using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;

namespace Monit.API.Repositories.Interfaces;

public interface IStockCategoryRepository
{
    Task<PagedResult<StockCategoryListDto>>  GetAllAsync(StockCategoryFilterRequest filter);
    Task<List<StockCategoryListDto>>         GetAllForExportAsync(StockCategoryFilterRequest filter);
    Task<StockCategoryDetailDto?>            GetByIdAsync(int id);
    Task<List<StockCategoryDropdownDto>>     GetDropdownAsync(int? stockGroupId = null);
    Task<bool>                               CodeExistsAsync(string code, int? excludeId = null);
    Task<int>                                CreateAsync(StockCategory entity);
    Task                                     UpdateAsync(StockCategory entity);
    Task                                     SoftDeleteAsync(int id, string deletedBy);
    Task<List<StockCategoryDetailDto>>       BulkCreateAsync(List<StockCategory> entities);
}
