using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Monit.API.Common.Helpers;

namespace Monit.API.Data;

/// <summary>
/// Creates open IDbConnections.
/// Create()            — reads company_id from the current JWT (all authenticated requests).
/// CreateForCompany(n) — used during login/refresh before JWT exists on the request.
/// </summary>
public class DbConnectionFactory(AppConfig config, IHttpContextAccessor http)
{
    public IDbConnection Create()
    {
        var companyId = GetCompanyIdFromContext();
        return CreateForCompany(companyId);
    }

    public IDbConnection CreateForCompany(int companyId)
    {
        var conn = new SqlConnection(config.GetConnectionString(companyId));
        try
        {
            conn.Open();
        }
        catch (SqlException)
        {
            SqlConnection.ClearAllPools();
            throw;
        }
        return conn;
    }

    public async Task<IDbConnection> CreateForCompanyAsync(int companyId)
    {
        var conn = new SqlConnection(config.GetConnectionString(companyId));
        try
        {
            await conn.OpenAsync();
        }
        catch (SqlException)
        {
            SqlConnection.ClearAllPools();
            throw;
        }
        return conn;
    }

    public async Task<IDbConnection> CreateAsync()
    {
        var companyId = GetCompanyIdFromContext();
        return await CreateForCompanyAsync(companyId);
    }

    private int GetCompanyIdFromContext()
    {
        var claim = http.HttpContext?.User?.FindFirst("company_id")?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}
