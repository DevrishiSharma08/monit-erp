using Microsoft.AspNetCore.Http;

namespace Monit.API.Common.Helpers;

public static class HttpContextExtensions
{
    // Same claim-read as DbConnectionFactory.GetCompanyIdFromContext() — the
    // tenant the current request is actually authenticated against. Services
    // that need the logged-in company's own config (e.g. for a PDF header)
    // must resolve it this way rather than hardcoding company 1, or every
    // Associates-tenant (company_id=2) request silently pulls company 1's
    // config instead of its own (client-reported: PO/SO "Billed To" showed
    // the wrong company name/GST/address on the Associates tenant).
    public static int GetCompanyId(this IHttpContextAccessor http)
    {
        var claim = http.HttpContext?.User?.FindFirst("company_id")?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}
