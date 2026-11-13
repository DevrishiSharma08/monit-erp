using Monit.API.Models.DTOs.Inventory;

namespace Monit.API.Services.Interfaces;

public interface IDeliveryChallanPdfService
{
    byte[] Generate(DeliveryChallanDto dc, string companyName, string companyAddress, string companyGst, string? companyPan);

    // Same layout as Generate() above, rendered as a single stitched JPG —
    // matches the SO/PO "Export as Image" pattern (client-requested so a
    // challan can be shared, e.g. on WhatsApp, without a PDF viewer).
    byte[] GenerateImage(DeliveryChallanDto dc, string companyName, string companyAddress, string companyGst, string? companyPan);
}
