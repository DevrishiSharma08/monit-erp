using Monit.API.Models.DTOs.Sales;

namespace Monit.API.Services.Interfaces;

public interface ISalesOrderPdfService
{
    byte[] Generate(SalesOrderListDto so, string companyName, string companyAddress, string companyGst);
    byte[] GenerateImage(SalesOrderListDto so, string companyName, string companyAddress, string companyGst);

    // Multi-SO PDF — used by the grid Export so the file matches the single
    // SO document layout (Preview / Print), one SO per page.
    byte[] GenerateBulk(IEnumerable<SalesOrderListDto> sos, string companyName, string companyAddress, string companyGst);
}
