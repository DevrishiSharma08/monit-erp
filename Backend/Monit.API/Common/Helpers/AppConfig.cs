namespace Monit.API.Common.Helpers;

/// <summary>
/// Single place to read all configuration.
/// ALL config access goes through here — no IConfiguration injected
/// directly into controllers or services.
///
/// Priority (highest → lowest):
///   1. Environment variables  (production secrets)
///   2. appsettings.{Environment}.json
///   3. appsettings.json
///
/// Required environment variables in production:
///   ConnectionStrings__Default   → SQL Server connection string
///   Jwt__Secret                  → minimum 32-character random string
/// </summary>
public class AppConfig
{
    public string ConnectionString    { get; }
    public string JwtSecret           { get; }
    public string JwtIssuer           { get; }
    public string JwtAudience         { get; }
    public int    JwtAccessExpiryHours   { get; }
    public int    JwtRefreshExpiryDays   { get; }
    public string[] CorsOrigins       { get; }
    public string CompanyName         { get; }
    public string CompanyAddress      { get; }

    public AppConfig(IConfiguration config)
    {
        ConnectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
               "ConnectionStrings:Default is not configured. " +
               "Set environment variable: ConnectionStrings__Default");

        JwtSecret = config["Jwt:Secret"]
            ?? throw new InvalidOperationException(
               "Jwt:Secret is not configured. " +
               "Set environment variable: Jwt__Secret");

        if (JwtSecret.Length < 32)
            throw new InvalidOperationException("Jwt:Secret must be at least 32 characters.");

        JwtIssuer             = config["Jwt:Issuer"]   ?? "monit-erp-api";
        JwtAudience           = config["Jwt:Audience"] ?? "monit-erp-frontend";
        JwtAccessExpiryHours  = config.GetValue<int>("Jwt:AccessTokenExpiryHours",  8);
        JwtRefreshExpiryDays  = config.GetValue<int>("Jwt:RefreshTokenExpiryDays",  7);
        CorsOrigins           = config.GetSection("Cors:AllowedOrigins").Get<string[]>()
                                ?? ["http://localhost:3000"];
        CompanyName           = config["Export:CompanyName"]    ?? "Monit Paper Agency";
        CompanyAddress        = config["Export:CompanyAddress"] ?? "Indore";
    }
}
