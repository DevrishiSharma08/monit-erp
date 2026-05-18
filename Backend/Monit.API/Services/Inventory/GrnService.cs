using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Inventory;

public class GrnService(IGrnRepository repo) : IGrnService
{
    // ── Allowed status transitions ────────────────────────────────────────────
    private static readonly Dictionary<string, string[]> ValidTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"]              = ["QC Pending", "Approved", "Stock Updated", "Discrepancy Raised"],
        ["QC Pending"]         = ["Approved", "Discrepancy Raised"],
        ["Approved"]           = ["Stock Updated", "Discrepancy Raised"],
        ["Stock Updated"]      = [],
        ["Discrepancy Raised"] = ["QC Pending", "Approved"],
    };

    // ── GetAllAsync ───────────────────────────────────────────────────────────

    public async Task<PagedResult<GrnListDto>> GetAllAsync(GrnFilterRequest filter)
        => await repo.GetAllAsync(filter);

    // ── GetByIdAsync ──────────────────────────────────────────────────────────

    public async Task<GrnDetailDto> GetByIdAsync(int id)
    {
        var grn = await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"GRN {id} not found.");
        return grn;
    }

    // ── CreateAsync ───────────────────────────────────────────────────────────

    public async Task<GrnListDto> CreateAsync(CreateGrnDto dto, string createdBy)
    {
        // 1. Resolve tracker context (PO / Material / Mill details + billing mode)
        var ctx = await repo.GetTrackerContextAsync(dto.MillTrackerId)
            ?? throw new KeyNotFoundException($"MillTracker {dto.MillTrackerId} not found.");

        // 2. How much has already been received for this tracker?
        var prevQty = await repo.GetPreviouslyReceivedQtyAsync(dto.MillTrackerId);

        // 3. Compute delivery routing split
        var (deliveryMode, stockQty, directQty, directClientId) =
            ComputeDeliveryRouting(dto, ctx);

        // 4. Resolve direct client name (if applicable)
        var directClientName = directClientId.HasValue
            ? await repo.GetCustomerNameAsync(directClientId.Value)
            : null;

        // 5. Auto-determine initial status from QC result
        var status = DetermineInitialStatus(dto.QcResult);

        // 6. Generate GRN number and lot number
        var cv = new GrnComputedValues
        {
            GrnNumber        = GenerateGrnNumber(dto.GrnDate),
            LotNumber        = GenerateLotNumber(ctx, dto.GrnDate),
            Status           = status,
            PrevQty          = prevQty,
            DeliveryMode     = deliveryMode,
            StockQty         = stockQty,
            DirectQty        = directQty,
            DirectClientId   = directClientId,
            DirectClientName = directClientName,
        };

        // 7. Insert GRN row
        var grn = await repo.CreateAsync(dto, ctx, cv, createdBy);

        // 8. Write initial status log entry
        await repo.LogStatusChangeAsync(grn.Id, null, status, dto.Remarks, createdBy);

        // 9. Create StockLot immediately if finalised and stock portion > 0
        if (status.Equals("Stock Updated", StringComparison.OrdinalIgnoreCase) && stockQty > 0)
        {
            var fifoSeq = await repo.GetNextFifoSequenceAsync(ctx.MaterialId);
            await repo.CreateStockLotAsync(grn.Id, ctx, cv.LotNumber, stockQty, ctx.Rate, fifoSeq, createdBy);
        }

        return grn;
    }

    // ── UpdateAsync ───────────────────────────────────────────────────────────

    public async Task<GrnDetailDto> UpdateAsync(int id, UpdateGrnDto dto, string updatedBy)
    {
        _ = await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"GRN {id} not found.");

        await repo.UpdateAsync(id, dto, updatedBy);
        return (await repo.GetByIdAsync(id))!;
    }

    // ── UpdateStatusAsync ─────────────────────────────────────────────────────

    public async Task<GrnDetailDto> UpdateStatusAsync(int id, UpdateGrnStatusDto dto, string updatedBy)
    {
        var existing = await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"GRN {id} not found.");

        // Validate transition
        if (ValidTransitions.TryGetValue(existing.Status, out var allowed)
            && !allowed.Contains(dto.Status, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Cannot transition GRN from '{existing.Status}' to '{dto.Status}'.");
        }

        await repo.UpdateStatusAsync(id, dto, updatedBy);
        await repo.LogStatusChangeAsync(id, existing.Status, dto.Status, dto.Remarks, updatedBy);

        // Create StockLot when transitioning to Stock Updated (StockQty portion only)
        if (dto.Status.Equals("Stock Updated", StringComparison.OrdinalIgnoreCase)
            && !existing.Status.Equals("Stock Updated", StringComparison.OrdinalIgnoreCase)
            && existing.StockQty > 0)
        {
            var ctx = await repo.GetTrackerContextAsync(existing.MillTrackerId!.Value)
                ?? throw new KeyNotFoundException("Tracker context not found.");

            var fifoSeq = await repo.GetNextFifoSequenceAsync(existing.MaterialId);
            await repo.CreateStockLotAsync(
                existing.Id, ctx, existing.LotNumber!, existing.StockQty, ctx.Rate, fifoSeq, updatedBy);
        }

        return (await repo.GetByIdAsync(id))!;
    }

    // ── DeleteAsync ───────────────────────────────────────────────────────────

    public async Task DeleteAsync(int id, string deletedBy)
    {
        var existing = await repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"GRN {id} not found.");

        if (existing.Status.Equals("Stock Updated", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Cannot delete a GRN with status 'Stock Updated'. Stock has already been updated.");

        await repo.SoftDeleteAsync(id, deletedBy);
    }

    // ── Private: Delivery Routing ─────────────────────────────────────────────

    private static (string mode, decimal stockQty, decimal directQty, int? directClientId)
        ComputeDeliveryRouting(CreateGrnDto dto, GrnTrackerContext ctx)
    {
        var mode    = string.IsNullOrWhiteSpace(dto.GrnDeliveryMode) ? "StockIn" : dto.GrnDeliveryMode;
        var goodQty = dto.ReceivedQty - dto.DamagedQty;
        if (goodQty < 0) goodQty = 0;

        // Auto-resolve direct client: explicit on DTO → PO.DirectCustomerId → Tracker.CustomerId
        int? ResolveClient() =>
            dto.DirectClientId ?? ctx.DirectCustomerId ?? ctx.CustomerId;

        return mode switch
        {
            "DirectToClient" => (mode, 0,               goodQty,        ResolveClient()),
            "Split"          => ComputeSplit(dto, goodQty, ResolveClient()),
            _                => ("StockIn", goodQty,    0,              null),
        };
    }

    private static (string, decimal, decimal, int?) ComputeSplit(CreateGrnDto dto, decimal goodQty, int? clientId)
    {
        if (dto.DirectQty <= 0 || dto.DirectQty >= goodQty)
            throw new InvalidOperationException(
                "Split delivery requires DirectQty > 0 and less than (ReceivedQty − DamagedQty).");

        return ("Split", goodQty - dto.DirectQty, dto.DirectQty, clientId);
    }

    // ── Private: Initial Status ───────────────────────────────────────────────

    private static string DetermineInitialStatus(string? qcResult)
    {
        if (string.IsNullOrWhiteSpace(qcResult)) return "Draft";
        return qcResult switch
        {
            "Rejected"             => "Discrepancy Raised",
            "Hold"                 => "QC Pending",
            "Accepted"             => "Stock Updated",
            "Accepted with Remark" => "Stock Updated",
            _                      => "Draft"
        };
    }

    // ── Private: Number Generators ────────────────────────────────────────────

    private static string GenerateGrnNumber(string grnDate)
    {
        var year = DateTime.TryParse(grnDate, out var d) ? d.Year : DateTime.UtcNow.Year;
        var seq  = DateTime.UtcNow.ToString("yyMMddHHmmssfff");
        return $"GRN-{year}-{seq}";
    }

    private static string GenerateLotNumber(GrnTrackerContext ctx, string grnDate)
    {
        // Format: {MillCode}-{Cat4}-{GSM}-{SizeShort}-{YYYYMMDD}-{HHmmssfff}
        var mill     = (ctx.MillCode ?? "ML").ToUpperInvariant();
        var cat      = (ctx.CategoryCode ?? "PAPR")[..Math.Min(4, (ctx.CategoryCode ?? "PAPR").Length)].ToUpperInvariant();
        var gsm      = ctx.Gsm?.ToString() ?? "000";
        var size     = (ctx.Size ?? "STD").Replace(" ", "").Replace("x", "X");
        var datePart = DateTime.TryParse(grnDate, out var d) ? d.ToString("yyyyMMdd") : DateTime.UtcNow.ToString("yyyyMMdd");
        var seq      = DateTime.UtcNow.ToString("HHmmssfff");
        return $"{mill}-{cat}-{gsm}-{size}-{datePart}-{seq}";
    }
}
