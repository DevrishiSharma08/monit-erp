using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;

namespace Monit.API.Services.Interfaces;

public interface IStockCategoryService
{
    Task<PagedResult<StockCategoryListDto>>  GetAllAsync(StockCategoryFilterRequest filter);
    Task<StockCategoryDetailDto>             GetByIdAsync(int id);
    Task<List<StockCategoryDropdownDto>>     GetDropdownAsync(int? stockGroupId = null);
    Task<StockCategoryDetailDto>             CreateAsync(CreateStockCategoryDto dto, string createdBy);
    Task<StockCategoryDetailDto>             UpdateAsync(int id, UpdateStockCategoryDto dto, string updatedBy);
    Task                                     DeleteAsync(int id, string deletedBy);
    Task<byte[]>                             ExportAsync(StockCategoryFilterRequest filter, string format);
    Task<List<StockCategoryDetailDto>>       BulkCreateAsync(BulkCreateGsmDto dto, string createdBy);
}
