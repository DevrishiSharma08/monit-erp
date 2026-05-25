using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Procurement;

public class TruckLoadPlanService(
    ITruckLoadPlanRepository planRepo,
    IMillTrackerRepository   trackerRepo
) : ITruckLoadPlanService
{
    // ── Valid status progression ──────────────────────────────────────────────
    private static readonly string[] StatusSeq = ["Planned", "Loading", "Dispatched", "Received"];

    // ── Queries ───────────────────────────────────────────────────────────────

    public Task<PagedResult<TruckLoadPlanDto>> GetAllAsync(TruckLoadPlanFilterRequest filter)
        => planRepo.GetAllAsync(filter);

    public async Task<TruckLoadPlanDto> GetByIdAsync(int id)
        => await planRepo.GetByIdAsync(id) ?? throw new NotFoundException($"Truck load plan {id} not found.");

    // ── Create ────────────────────────────────────────────────────────────────

    public async Task<TruckLoadPlanDto> CreateAsync(CreateTruckLoadPlanDto dto, string createdBy)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ValidationException("At least one item is required.");

        if (string.IsNullOrWhiteSpace(dto.TruckNumber))
            throw new ValidationException("Truck number is required.");

        if (string.IsNullOrWhiteSpace(dto.TransporterName))
            throw new ValidationException("Transporter name is required.");

        if (string.IsNullOrWhiteSpace(dto.PlannedLoadDate))
            throw new ValidationException("Planned load date is required.");

        var planNumber = await GeneratePlanNumberAsync();

        var planId = await planRepo.CreateAsync(dto, planNumber, createdBy);
        return await GetByIdAsync(planId);
    }

    // ── Status update + downstream mill tracker sync ──────────────────────────

    public async Task<TruckLoadPlanDto> UpdateStatusAsync(int id, UpdateTruckLoadPlanStatusDto dto, string updatedBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Status))
            throw new ValidationException("Status is required.");

        var plan = await GetByIdAsync(id);

        var oldIdx = Array.IndexOf(StatusSeq, plan.Status);
        var newIdx = Array.IndexOf(StatusSeq, dto.Status);

        if (newIdx < 0)
            throw new ValidationException($"Invalid status '{dto.Status}'. Valid values: {string.Join(", ", StatusSeq)}");

        if (newIdx <= oldIdx)
            throw new ValidationException($"Cannot move from '{plan.Status}' to '{dto.Status}'. Status can only advance forward.");

        // ── Persist plan status ───────────────────────────────────────────────
        await planRepo.UpdateStatusAsync(id, dto, updatedBy);

        // ── When truck moves to "Dispatched" → sync mill trackers ────────────
        // This is the key business rule: mill dispatch dispatched qty advances
        // and status becomes Dispatched / Partial Dispatched accordingly.
        if (dto.Status == "Dispatched")
            await SyncTrackerDispatchAsync(plan, updatedBy);

        return await GetByIdAsync(id);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id); // throws NotFoundException if missing
        await planRepo.SoftDeleteAsync(id, deletedBy);
    }

    // ── Private: plan number generation ──────────────────────────────────────

    private async Task<string> GeneratePlanNumberAsync()
    {
        var count = await planRepo.CountAsync();
        var year  = DateTime.UtcNow.Year;
        return $"TLP-{year}-{(count + 1):D3}";
    }

    // ── Private: update mill tracker DispatchedQty when truck goes In Transit ─

    private async Task SyncTrackerDispatchAsync(TruckLoadPlanDto plan, string updatedBy)
    {
        // Group plan items by TrackerId so one tracker gets all quantities summed
        var trackerGroups = plan.Items
            .Where(i => i.TrackerId.HasValue)
            .GroupBy(i => i.TrackerId!.Value)
            .ToList();

        foreach (var group in trackerGroups)
        {
            var trackerId     = group.Key;
            var dispatchedQty = group.Sum(i => i.Quantity);

            var tracker = await trackerRepo.GetByIdAsync(trackerId);
            if (tracker == null) continue;

            var newDispatched = tracker.DispatchedQty + dispatchedQty;
            var newReady      = tracker.ReadyQty - dispatchedQty;

            // Determine new production status
            string newStatus;
            if (newDispatched >= tracker.OrderedQty)
                newStatus = "Dispatched";
            else if (newDispatched > 0)
                newStatus = "Partial Dispatched";
            else
                newStatus = tracker.ProductionStatus; // no change if somehow zero

            var note = $"Truck {plan.TruckNumber ?? plan.PlanNumber} dispatched {dispatchedQty:0.##} sheets";

            await trackerRepo.UpdateStatusAsync(trackerId, new UpdateMillTrackerStatusDto
            {
                Status   = newStatus,
                ReadyQty = newReady > 0 ? newReady : 0,
                Note     = note,
            }, updatedBy);
        }
    }
}
