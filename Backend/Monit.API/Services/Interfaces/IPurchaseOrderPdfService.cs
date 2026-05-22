using Monit.API.Models.DTOs.Procurement;

namespace Monit.API.Services.Interfaces;

public interface IPurchaseOrderPdfService
{
    byte[] Generate(PurchaseOrderListDto po, string companyName, string companyAddress, string companyGst);
}
