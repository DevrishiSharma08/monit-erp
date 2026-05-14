using System.Data;
using Microsoft.Data.SqlClient;
using Monit.API.Common.Helpers;

namespace Monit.API.Data;

/// <summary>
/// Creates a new open IDbConnection.
/// Injected into every repository.
/// Connection string comes from AppConfig (never hardcoded).
/// </summary>
public class DbConnectionFactory(AppConfig config)
{
    private readonly string _connectionString = config.ConnectionString;

    public IDbConnection Create()
    {
        var conn = new SqlConnection(_connectionString);
        conn.Open();
        return conn;
    }
}
