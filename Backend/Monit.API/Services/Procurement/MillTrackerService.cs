using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Procurement;

public class MillTrackerService(IMillTrackerRepository repo) : IMillTrackerService
{
    public Task<PagedResult<MillTrackerListDto>> GetAllAsync(MillTrackerFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<MillTrackerListDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Mill tracker {id} not found.");

    public Task<List<MillTrackerListDto>> GetByPoIdAsync(int poId)
        => repo.GetByPoIdAsync(poId);

    public async Task<MillTrackerListDto> UpdateStatusAsync(int id, UpdateMillTrackerStatusDto dto, string updatedBy)
    {
        if (string.IsNullOrWhiteSpace(dto.Status))
            throw new ValidationException("Status is required.");

        await GetByIdAsync(id);
        await repo.UpdateStatusAsync(id, dto, updatedBy);
        return await GetByIdAsync(id);
    }

    public async Task<MillTrackerBatchDto> AddBatchAsync(int id, AddMillTrackerBatchDto batch, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(batch.DeliveryDate))
            throw new ValidationException("Delivery date is required.");
        if (batch.Quantity <= 0)
            throw new ValidationException("Batch quantity must be greater than zero.");

        await GetByIdAsync(id);
        return await repo.AddBatchAsync(id, batch, createdBy);
    }

    public async Task<BulkImportResultDto> BulkImportAsync(List<BulkImportRowDto> rows, string updatedBy)
    {
        var result = new BulkImportResultDto();
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.PoNumber)) { result.Skipped++; continue; }

            var trackers = await repo.GetByPoNumberAsync(row.PoNumber.Trim());
            if (trackers.Count == 0)
            {
                result.Skipped++;
                result.Errors.Add($"{row.PoNumber}: no matching tracker found");
                continue;
            }

            foreach (var tracker in trackers)
            {
                try
                {
                    await repo.UpdateStatusAsync(tracker.Id, new UpdateMillTrackerStatusDto
                    {
                        Status           = string.IsNullOrWhiteSpace(row.Status) ? tracker.ProductionStatus : row.Status.Trim(),
                        ReadyQty         = row.ReadyQty,
                        Note             = row.Remarks,
                        ExpectedDelivery = row.ExpectedDelivery,
                    }, updatedBy);
                    result.Updated++;
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"{row.PoNumber}: {ex.Message}");
                }
            }
        }
        return result;
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }
}
