using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Services.Interfaces;

public interface IPurchaseOrderPdfService
{
    byte[] Generate(PurchaseOrderListDto po, string companyName, string companyAddress, string companyGst);
    byte[] GenerateImage(PurchaseOrderListDto po, string companyName, string companyAddress, string companyGst);

    // Multi-PO PDF — used by the grid "Export → PDF" so the file matches the
    // single PO document layout (Preview / Print), one PO per page.
    byte[] GenerateBulk(IEnumerable<PurchaseOrderListDto> pos, string companyName, string companyAddress, string companyGst);
}
