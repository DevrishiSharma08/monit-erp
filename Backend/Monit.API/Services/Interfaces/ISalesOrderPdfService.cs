using Monit.API.Models.DTOs.Sales;

namespace Monit.API.Services.Interfaces;

public interface ISalesOrderPdfService
{
    byte[] Generate(SalesOrderListDto so, string companyName, string companyAddress, string companyGst);
}
