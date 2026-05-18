using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Procurement;

public class PurchaseOrderService(
    IPurchaseOrderRepository  repo,
    IMillTrackerRepository    millTrackerRepo) : IPurchaseOrderService
{
    public Task<PagedResult<PurchaseOrderListDto>> GetAllAsync(PurchaseOrderFilterRequest filter)
        => repo.GetAllAsync(filter);

    public async Task<PurchaseOrderListDto> GetByIdAsync(int id)
        => await repo.GetByIdAsync(id) ?? throw new NotFoundException($"Purchase order {id} not found.");

    public async Task<PurchaseOrderListDto> CreateAsync(CreatePurchaseOrderDto dto, string createdBy)
    {
        if (dto.MillId <= 0)           throw new ValidationException("Mill is required.");
        if (dto.Items.Count == 0)      throw new ValidationException("At least one item is required.");
        if (string.IsNullOrWhiteSpace(dto.OrderDate)) throw new ValidationException("Order date is required.");

        var po       = MapToListDto(dto);
        var id       = await repo.CreateAsync(po, dto.Items, createdBy);
        var fullPo   = await GetByIdAsync(id);
        await millTrackerRepo.CreateForPoAsync(fullPo, createdBy);
        return fullPo;
    }

    public async Task<PurchaseOrderListDto> UpdateAsync(int id, UpdatePurchaseOrderDto dto, string updatedBy)
    {
        var oldPo = await GetByIdAsync(id);
        if (dto.MillId <= 0)           throw new ValidationException("Mill is required.");
        if (dto.Items.Count == 0)      throw new ValidationException("At least one item is required.");

        var po = MapToListDto(dto);
        if (!string.IsNullOrEmpty(dto.Status)) po.Status = dto.Status;
        await repo.UpdateAsync(id, po, dto.Items, updatedBy);
        var updatedPo = await GetByIdAsync(id);
        await millTrackerRepo.SyncForPoUpdateAsync(id, oldPo, updatedPo, updatedBy);
        return updatedPo;
    }

    public async Task ApproveAsync(int id, string updatedBy)
    {
        await GetByIdAsync(id);
        await repo.UpdateStatusAsync(id, "Sent to Mill", updatedBy);
    }

    public async Task DeleteAsync(int id, string deletedBy)
    {
        await GetByIdAsync(id);
        await repo.SoftDeleteAsync(id, deletedBy);
    }

    private static PurchaseOrderListDto MapToListDto(CreatePurchaseOrderDto dto) => new()
    {
        MillId                = dto.MillId,
        OrderDate             = dto.OrderDate,
        POType                = dto.POType,
        LinkedSOId            = dto.LinkedSOId,
        DeliveryMode          = dto.DeliveryMode,
        ShipmentMode          = dto.ShipmentMode ?? "Normal",
        BlindShipment         = dto.BlindShipment,
        InvoiceParty          = dto.InvoiceParty,
        InvoicePartyId        = dto.InvoicePartyId,
        DirectCustomerId      = dto.DirectCustomerId,
        DirectDeliveryAddress = dto.DirectDeliveryAddress,
        ExpectedDeliveryDate  = dto.ExpectedDeliveryDate,
        MillSONumber          = dto.MillSONumber,
        PaymentTerms          = dto.PaymentTerms,
        TotalQuantity         = dto.TotalQuantity,
        TotalValue            = dto.TotalValue,
        Status                = "Approval Pending",
        GSTPercentage         = dto.GSTPercentage,
        Remarks               = dto.Remarks,
        SpecialInstructions   = dto.SpecialInstructions,
    };
}
