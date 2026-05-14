using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class RateService(
    IRateRepository  repo,
    IMQGRepository   mqgRepo,
    IExportService   exportService,
    AppConfig        appConfig) : IRateService
{
    public Task<PagedResult<RateListDto>> GetCurrentRatesAsync(RateFilterRequest f)
        => repo.GetCurrentRatesAsync(f);

    public Task<List<SORateDto>> GetForCustomerAsync(int customerId)
        => repo.GetForCustomerAsync(customerId);

    public Task<List<RateHistoryDto>> GetHistoryAsync(int rateId)
        => repo.GetHistoryAsync(rateId);

    public async Task<List<RateListDto>> CreateSaleRatesAsync(CreateSaleRateDto dto, string createdBy)
    {
        var errors = new List<string>();
        if (dto.MillId <= 0)    errors.Add("Mill is required.");
        if (dto.QualityId <= 0) errors.Add("Quality is required.");
        if (dto.GsmMin <= 0)    errors.Add("GSM Min must be greater than zero.");
        if (dto.GsmMax <= 0 || dto.GsmMax < dto.GsmMin) errors.Add("GSM Max must be >= GSM Min.");
        if (string.IsNullOrWhiteSpace(dto.Type) || (dto.Type != "Reel" && dto.Type != "Sheet"))
            errors.Add("Type must be 'Reel' or 'Sheet'.");
        if (dto.Amount <= 0)   errors.Add("Rate must be greater than zero.");
        if (dto.EffectiveFrom == default) errors.Add("Effective From date is required.");
        if (errors.Count > 0)  throw new ValidationException(errors);

        var mqgId     = await FindOrCreateMQGAsync(dto.MillId, dto.QualityId, dto.GsmMin, dto.GsmMax, dto.Type, createdBy);
        var customers = dto.CustomerIds?.Where(id => id > 0).Distinct().ToList() ?? [];
        var now       = DateTime.UtcNow;

        var customerList = customers.Count > 0 ? customers.Cast<int?>().ToList() : [null];
        var insertedIds  = new List<int>();
        foreach (var customerId in customerList)
        {
            var id = await repo.CreateAsync(new Rate
            {
                MQGId         = mqgId,
                RateType      = "Sale",
                RateCategory  = null,
                CustomerId    = customerId,
                Amount        = dto.Amount,
                Discount      = dto.Discount,
                EffectiveFrom = dto.EffectiveFrom,
                IsActive      = true,
                CreatedAt     = now,
                CreatedBy     = createdBy
            });
            insertedIds.Add(id);
        }

        var filter = new RateFilterRequest { RateType = "Sale", MQGId = mqgId, PageSize = 200 };
        var result = await repo.GetCurrentRatesAsync(filter);
        return result.Items
            .Where(r => insertedIds.Contains(r.Id) || (dto.CustomerIds == null && r.CustomerId == null))
            .ToList();
    }

    public async Task<List<RateListDto>> CreatePurchaseRatesAsync(CreatePurchaseRateDto dto, string createdBy)
    {
        var errors = new List<string>();
        if (dto.MillId <= 0)    errors.Add("Mill is required.");
        if (dto.QualityId <= 0) errors.Add("Quality is required.");
        if (dto.GsmMin <= 0)    errors.Add("GSM Min must be greater than zero.");
        if (dto.GsmMax <= 0 || dto.GsmMax < dto.GsmMin) errors.Add("GSM Max must be >= GSM Min.");
        if (string.IsNullOrWhiteSpace(dto.Type) || (dto.Type != "Reel" && dto.Type != "Sheet"))
            errors.Add("Type must be 'Reel' or 'Sheet'.");
        if (dto.Amount <= 0)                             errors.Add("Rate must be greater than zero.");
        if (dto.EffectiveFrom == default)                errors.Add("Effective From date is required.");
        if (string.IsNullOrWhiteSpace(dto.RateCategory)) errors.Add("Rate Category is required.");
        else if (dto.RateCategory != "Self" && dto.RateCategory != "Customer")
                                                          errors.Add("Rate Category must be 'Self' or 'Customer'.");
        if (dto.RateCategory == "Customer" && (dto.CustomerIds == null || dto.CustomerIds.Count == 0))
                                                          errors.Add("At least one customer is required for Customer category.");
        if (errors.Count > 0) throw new ValidationException(errors);

        var mqgId      = await FindOrCreateMQGAsync(dto.MillId, dto.QualityId, dto.GsmMin, dto.GsmMax, dto.Type, createdBy);
        var now        = DateTime.UtcNow;
        var insertedIds = new List<int>();

        if (dto.RateCategory == "Self")
        {
            var id = await repo.CreateAsync(new Rate
            {
                MQGId         = mqgId,
                RateType      = "Purchase",
                RateCategory  = "Self",
                CustomerId    = null,
                Amount        = dto.Amount,
                Discount      = dto.Discount,
                EffectiveFrom = dto.EffectiveFrom,
                IsActive      = true,
                CreatedAt     = now,
                CreatedBy     = createdBy
            });
            insertedIds.Add(id);
        }
        else
        {
            foreach (var customerId in dto.CustomerIds!.Where(id => id > 0).Distinct())
            {
                var id = await repo.CreateAsync(new Rate
                {
                    MQGId         = mqgId,
                    RateType      = "Purchase",
                    RateCategory  = "Customer",
                    CustomerId    = customerId,
                    Amount        = dto.Amount,
                    Discount      = dto.Discount,
                    EffectiveFrom = dto.EffectiveFrom,
                    IsActive      = true,
                    CreatedAt     = now,
                    CreatedBy     = createdBy
                });
                insertedIds.Add(id);
            }
        }

        var filter = new RateFilterRequest { RateType = "Purchase", MQGId = mqgId, PageSize = 200 };
        var result = await repo.GetCurrentRatesAsync(filter);
        return result.Items.Where(r => insertedIds.Contains(r.Id)).ToList();
    }

    public async Task DeleteAsync(int id, string deletedBy)
        => await repo.SoftDeleteAsync(id, deletedBy);

    public async Task<byte[]> ExportAsync(RateFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Mill", "Quality", "GSM Range", "Type", "Rate Type", "Category", "Customer", "Rate (₹/KG)", "Discount (₹/KG)", "Effective From", "Status" };
        var rows    = data.Select(x => new List<string>
        {
            x.MillName,
            x.QualityName,
            $"{x.GsmMin}–{x.GsmMax}g",
            x.Type,
            x.RateType,
            x.RateCategory ?? "—",
            x.CustomerName ?? "All",
            x.Amount.ToString("N4"),
            x.Discount?.ToString("N4") ?? "—",
            x.EffectiveFrom,
            x.IsActive ? "Active" : "Inactive"
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Rates", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Rate Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Rate Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    // Finds an existing MQG combo or creates a new one automatically.
    private async Task<int> FindOrCreateMQGAsync(int millId, int qualityId, int gsmMin, int gsmMax, string type, string createdBy)
    {
        var existingId = await mqgRepo.GetIdByComboAsync(millId, qualityId, gsmMin, gsmMax, type);
        if (existingId.HasValue) return existingId.Value;

        var (millCode, qualityName) = await mqgRepo.GetCodePartsAsync(millId, qualityId);
        var typeChar = type == "Reel" ? "R" : "S";
        var code     = $"{millCode}/{qualityName}/{gsmMin}-{gsmMax}/{typeChar}";

        return await mqgRepo.CreateAsync(new MillQualityGsm
        {
            Code      = code,
            MillId    = millId,
            QualityId = qualityId,
            GsmMin    = gsmMin,
            GsmMax    = gsmMax,
            Type      = type,
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        });
    }
}
