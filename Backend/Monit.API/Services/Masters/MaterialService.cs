using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Masters;

public class MaterialService(
    IMaterialRepository repo,
    IExportService      exportService,
    AppConfig           appConfig) : IMaterialService
{
    public Task<PagedResult<MaterialListDto>> GetAllAsync(MaterialFilterRequest f) => repo.GetAllAsync(f);
    public Task<List<MaterialDropdownDto>>    GetDropdownAsync(int? millId = null, int? qualityId = null)
        => repo.GetDropdownAsync(millId, qualityId);

    public async Task<MaterialDetailDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Item {id} not found.");

    public async Task<MaterialDetailDto> CreateAsync(CreateMaterialDto dto, string createdBy)
    {
        Validate(dto);

        var parts = await repo.GetCodePartsAsync(dto.MillId, dto.QualityId, dto.ItemTypeId)
            ?? throw new ValidationException("Invalid Mill, Quality, or Item Type reference.");

        var code = ComposeCode(parts.millCode, parts.qualityName, parts.qualityAlias, dto.GSM, dto.SizeLength, dto.SizeWidth);

        if (await repo.CodeExistsAsync(code))
            throw new ConflictException($"Item '{code}' already exists.");

        var id = await repo.CreateAsync(new Material
        {
            Code             = code,
            MillId           = dto.MillId,
            QualityId        = dto.QualityId,
            ItemTypeId       = dto.ItemTypeId,
            GSM              = dto.GSM,
            SizeLength       = dto.SizeLength,
            SizeWidth        = dto.SizeWidth,
            PackingType      = dto.PackingType.Trim(),
            SheetsPerPacket  = dto.SheetsPerPacket,
            PacketsPerBundle = dto.PacketsPerBundle,
            BundlesPerBox    = dto.BundlesPerBox,
            HsnCodeId        = dto.HsnCodeId,
            Grain            = dto.Grain?.Trim(),
            Description      = dto.Description?.Trim(),
            IsActive         = true,
            CreatedAt        = DateTime.UtcNow,
            CreatedBy        = createdBy
        });
        return await GetByIdAsync(id);
    }

    public async Task<MaterialDetailDto> UpdateAsync(int id, UpdateMaterialDto dto, string updatedBy)
    {
        await GetByIdAsync(id);
        Validate(dto);

        var parts = await repo.GetCodePartsAsync(dto.MillId, dto.QualityId, dto.ItemTypeId)
            ?? throw new ValidationException("Invalid Mill, Quality, or Item Type reference.");

        var code = ComposeCode(parts.millCode, parts.qualityName, parts.qualityAlias, dto.GSM, dto.SizeLength, dto.SizeWidth);

        if (await repo.CodeExistsAsync(code, id))
            throw new ConflictException($"Item '{code}' is already used by another record.");

        await repo.UpdateAsync(new Material
        {
            Id               = id,
            Code             = code,
            MillId           = dto.MillId,
            QualityId        = dto.QualityId,
            ItemTypeId       = dto.ItemTypeId,
            GSM              = dto.GSM,
            SizeLength       = dto.SizeLength,
            SizeWidth        = dto.SizeWidth,
            PackingType      = dto.PackingType.Trim(),
            SheetsPerPacket  = dto.SheetsPerPacket,
            PacketsPerBundle = dto.PacketsPerBundle,
            BundlesPerBox    = dto.BundlesPerBox,
            HsnCodeId        = dto.HsnCodeId,
            Grain            = dto.Grain?.Trim(),
            Description      = dto.Description?.Trim(),
            IsActive         = dto.IsActive,
            UpdatedAt        = DateTime.UtcNow,
            UpdatedBy        = updatedBy
        });
        return await GetByIdAsync(id);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    public async Task<byte[]> ExportAsync(MaterialFilterRequest filter, string format)
    {
        var data    = await repo.GetAllForExportAsync(filter);
        var headers = new List<string> { "Code", "Mill", "Quality", "GSM", "Type", "Size", "Packing", "Sheets/Pkt", "Pkts/Bundle", "Bundles/Box", "Status" };
        var rows    = data.Select(x => new List<string>
        {
            x.Code, x.MillName, x.QualityName,
            x.GSM.ToString(), x.ItemTypeName, x.SizeLabel, x.PackingType,
            x.SheetsPerPacket?.ToString()  ?? "—",
            x.PacketsPerBundle?.ToString() ?? "—",
            x.BundlesPerBox?.ToString()    ?? "—",
            x.IsActive ? "Active" : "Inactive"
        }).ToList();
        return format.ToLower() switch
        {
            "excel" => exportService.ToExcel("Items", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "pdf"   => exportService.ToPdf("Item Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            "word"  => exportService.ToWord("Item Master", headers, rows, appConfig.CompanyName, appConfig.CompanyAddress),
            _       => throw new ValidationException($"Unsupported format: {format}.")
        };
    }

    // e.g.  ITC/COTE/80/72x100  or  ITC/COTE/CK/80/72x100  (with brand)
    private static string ComposeCode(string millCode, string qualityName, string? brandName, int gsm, decimal sizeLength, decimal? sizeWidth)
    {
        var len      = Dim(sizeLength);
        var size     = sizeWidth.HasValue ? $"{len}x{Dim(sizeWidth.Value)}" : len;
        var qualPart = string.IsNullOrWhiteSpace(brandName)
            ? qualityName.ToUpper()
            : $"{qualityName.ToUpper()}/{brandName.ToUpper()}";
        return $"{millCode.ToUpper()}/{qualPart}/{gsm}/{size}";
    }

    private static string Dim(decimal d) => d % 1 == 0 ? ((int)d).ToString() : d.ToString("0.##");

    private static void Validate(CreateMaterialDto dto)
    {
        var errors = new List<string>();
        if (dto.MillId     <= 0)  errors.Add("Mill is required.");
        if (dto.QualityId  <= 0)  errors.Add("Quality is required.");
        if (dto.ItemTypeId <= 0)  errors.Add("Item Type is required.");
        if (dto.GSM        <= 0)  errors.Add("GSM must be a positive number.");
        if (dto.SizeLength <= 0)  errors.Add("Size length must be greater than zero.");
        if (!string.IsNullOrWhiteSpace(dto.PackingType))
        {
            var pt = dto.PackingType.Trim();
            if (pt == "Packet" && (dto.SheetsPerPacket ?? 0) <= 0)
                errors.Add("Sheets per Packet is required.");
            if (pt == "Bundle" && ((dto.SheetsPerPacket ?? 0) <= 0 || (dto.PacketsPerBundle ?? 0) <= 0))
                errors.Add("Sheets per Packet and Packets per Bundle are required.");
            if (pt == "Box" && ((dto.SheetsPerPacket ?? 0) <= 0 || (dto.PacketsPerBundle ?? 0) <= 0 || (dto.BundlesPerBox ?? 0) <= 0))
                errors.Add("All packing hierarchy fields are required for Box.");
        }
        if (errors.Count > 0) throw new ValidationException(errors);
    }
}
