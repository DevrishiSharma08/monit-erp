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

    // Close tracker — mill-side finalisation for short-delivery cases.
    // Reason is optional per client UAT.
    public async Task<MillTrackerListDto> CloseAsync(int id, CloseMillTrackerDto dto, string closedBy)
    {
        await GetByIdAsync(id);   // throws NotFound if missing
        await repo.CloseAsync(id, string.IsNullOrWhiteSpace(dto.Reason) ? null : dto.Reason.Trim(), closedBy);
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
                    // Same rule as the Excel path: auto-derive when the
                    // user didn't change the Status column (blank, or
                    // matches the current tracker status). Only an
                    // explicit different status acts as override.
                    var typed   = (row.Status ?? "").Trim();
                    var current = (tracker.ProductionStatus ?? "").Trim();

                    // A typed "Dispatched"/"Partial Dispatched" is only ever
                    // legitimate when it merely echoes back a tracker that's
                    // already dispatched — a genuine attempt to flip a
                    // non-dispatched tracker via the sheet is dropped instead
                    // of failing the whole row: dispatch can only be recorded
                    // from the real Dispatch page, but the user's OTHER edits
                    // (Ready/ExpectedDelivery/Remarks) on the same row still
                    // deserve to go through.
                    var typedIsDispatch = string.Equals(typed, "Dispatched", StringComparison.OrdinalIgnoreCase)
                                       || string.Equals(typed, "Partial Dispatched", StringComparison.OrdinalIgnoreCase);
                    var alreadyDispatched = string.Equals(current, "Dispatched", StringComparison.OrdinalIgnoreCase)
                                          || string.Equals(current, "Partial Dispatched", StringComparison.OrdinalIgnoreCase);
                    var blockedDispatchAttempt = typedIsDispatch && !alreadyDispatched
                                              && !string.Equals(typed, current, StringComparison.OrdinalIgnoreCase);

                    var userOverrode = !string.IsNullOrEmpty(typed)
                                    && !string.Equals(typed, current, StringComparison.OrdinalIgnoreCase)
                                    && !blockedDispatchAttempt;
                    var status = userOverrode
                        ? typed
                        : DeriveStatus(row.ReadyQty, tracker.OrderedQty, current);

                    if (blockedDispatchAttempt)
                        result.Warnings.Add($"{row.PoNumber}: \"{typed}\" status ignored — use the Dispatch page to record a dispatch. Other edited fields on this row were still applied.");

                    // Same "only touch what changed" guard as the Excel
                    // path — see BulkImportExcelAsync for why.
                    var readyChanged    = row.ReadyQty.HasValue && row.ReadyQty.Value != tracker.ReadyQty;
                    var statusChanged   = !string.Equals(status, current, StringComparison.OrdinalIgnoreCase);
                    var expectedChanged = !string.IsNullOrEmpty(row.ExpectedDelivery) && !string.Equals(row.ExpectedDelivery, tracker.ExpectedDelivery, StringComparison.Ordinal);
                    var remarksChanged  = !string.IsNullOrEmpty(row.Remarks) && !string.Equals(row.Remarks, tracker.Remarks, StringComparison.Ordinal);

                    if (!readyChanged && !statusChanged && !expectedChanged && !remarksChanged)
                    {
                        result.Unchanged++;
                        continue;
                    }

                    await repo.UpdateStatusAsync(tracker.Id, new UpdateMillTrackerStatusDto
                    {
                        Status           = status,
                        ReadyQty         = readyChanged    ? row.ReadyQty         : null,
                        Note             = remarksChanged  ? row.Remarks          : null,
                        ExpectedDelivery = expectedChanged ? row.ExpectedDelivery : null,
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

    public async Task<BulkImportResultDto> BulkImportExcelAsync(IList<BulkImportExcelRowDto> rows, string updatedBy)
    {
        // Excel re-upload flow — matches rows by tracker Id (downloaded with
        // the file) so multi-item POs disambiguate cleanly. Only ReadyQty /
        // Status / ExpectedDelivery are touched; everything else is read-only
        // reference data in the spreadsheet.
        var result = new BulkImportResultDto();
        foreach (var row in rows)
        {
            if (row.Id <= 0) { result.Skipped++; continue; }

            MillTrackerListDto tracker;
            try { tracker = await repo.GetByIdAsync(row.Id) ?? throw new NotFoundException($"Tracker {row.Id} not found."); }
            catch (Exception ex)
            {
                result.Skipped++;
                result.Errors.Add($"Row Id={row.Id}: {ex.Message}");
                continue;
            }

            try
            {
                // Auto-derive status from the new Ready Qty so the user
                // only needs to fill the Ready column — the row then flows
                // to Pending Dispatch on its own.
                //
                //   ready >= ordered  → Ready (picker can pull)
                //   ready > 0         → Partial Ready (some kg available)
                //   ready = 0         → keep existing status
                //
                // Important: the Excel export PRE-FILLS the Status column
                // with the current status, so a "non-blank" cell does NOT
                // mean the user explicitly set it. Auto-derive runs when:
                //   - the cell is blank, OR
                //   - the cell still matches the tracker's current status
                //     (i.e. the user didn't touch it — they only edited
                //     Ready Qty).
                // The cell wins only when its value DIFFERS from the
                // current status — that's the explicit-override signal
                // for edge cases (Delayed, Cancelled, hand-pick Ready, …).
                var typed   = (row.Status ?? "").Trim();
                var current = (tracker.ProductionStatus ?? "").Trim();

                // A typed "Dispatched"/"Partial Dispatched" is only ever
                // legitimate when it merely echoes back a tracker that's
                // already dispatched — a genuine attempt to flip a
                // non-dispatched tracker via the sheet is dropped instead of
                // failing the whole row: dispatch can only be recorded from
                // the real Dispatch page, but the user's OTHER edits
                // (Ready/ExpectedDelivery/Remarks) on the same row still
                // deserve to go through (client-reported: an edit to an
                // already-fine field shouldn't be lost just because the
                // Status cell — pre-filled by the export — happened to read
                // "Dispatched").
                var typedIsDispatch = string.Equals(typed, "Dispatched", StringComparison.OrdinalIgnoreCase)
                                   || string.Equals(typed, "Partial Dispatched", StringComparison.OrdinalIgnoreCase);
                var alreadyDispatched = string.Equals(current, "Dispatched", StringComparison.OrdinalIgnoreCase)
                                      || string.Equals(current, "Partial Dispatched", StringComparison.OrdinalIgnoreCase);
                var blockedDispatchAttempt = typedIsDispatch && !alreadyDispatched
                                          && !string.Equals(typed, current, StringComparison.OrdinalIgnoreCase);

                var userOverrode = !string.IsNullOrEmpty(typed)
                                && !string.Equals(typed, current, StringComparison.OrdinalIgnoreCase)
                                && !blockedDispatchAttempt;
                var status = userOverrode
                    ? typed
                    : DeriveStatus(row.ReadyQty, tracker.OrderedQty, current);

                if (blockedDispatchAttempt)
                    result.Warnings.Add($"Row Id={row.Id} ({tracker.PoNumber}): \"{typed}\" status ignored — use the Dispatch page to record a dispatch. Other edited fields on this row were still applied.");

                // Only touch what actually differs from the tracker's
                // current values. Without this, EVERY row in the file got
                // re-saved on every upload — even rows the user never
                // edited — which stamped a fresh LastUpdate/LastUpdatedBy
                // and a no-op History entry on untouched rows, and could
                // even silently roll a status like "In Production"/
                // "Delayed" forward to "Partial Ready" purely because its
                // (unchanged) Ready cell happens to be > 0 (client-reported:
                // expected only edited rows to change, everything else to
                // stay exactly as it was).
                var readyChanged    = row.ReadyQty.HasValue && row.ReadyQty.Value != tracker.ReadyQty;
                var statusChanged   = !string.Equals(status, current, StringComparison.OrdinalIgnoreCase);
                var expectedChanged = !string.IsNullOrEmpty(row.ExpectedDelivery) && !string.Equals(row.ExpectedDelivery, tracker.ExpectedDelivery, StringComparison.Ordinal);
                var remarksChanged  = !string.IsNullOrEmpty(row.Remarks) && !string.Equals(row.Remarks, tracker.Remarks, StringComparison.Ordinal);

                if (!readyChanged && !statusChanged && !expectedChanged && !remarksChanged)
                {
                    result.Unchanged++;
                    continue;
                }

                await repo.UpdateStatusAsync(row.Id, new UpdateMillTrackerStatusDto
                {
                    Status           = status,
                    ReadyQty         = readyChanged    ? row.ReadyQty         : null,
                    Note             = remarksChanged  ? row.Remarks          : null,
                    ExpectedDelivery = expectedChanged ? row.ExpectedDelivery : null,
                }, updatedBy);
                result.Updated++;
            }
            catch (Exception ex)
            {
                result.Skipped++;
                result.Errors.Add($"Row Id={row.Id}: {ex.Message}");
            }
        }
        return result;
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    // Auto-derive production status from the new Ready Qty when the user
    // didn't pick one in the spreadsheet. Returns the current status
    // unchanged when the Ready field is blank/zero — keeps the row stable
    // (no accidental rollback) — but rolls forward to Partial Ready / Ready
    // as soon as positive kg are reported. Terminal states (Dispatched /
    // Cancelled) are never overwritten since the row's life is already done.
    private static string DeriveStatus(decimal? newReady, decimal ordered, string currentStatus)
    {
        if (currentStatus is "Dispatched" or "Cancelled") return currentStatus;
        if (newReady is null || newReady <= 0)            return currentStatus;
        return ordered > 0 && newReady >= ordered
            ? "Ready"
            : "Partial Ready";
    }
}
