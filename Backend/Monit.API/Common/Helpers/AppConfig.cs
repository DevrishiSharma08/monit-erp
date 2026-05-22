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
///   ConnectionStrings__Company1  → Monit Paper Agency DB connection string
///   ConnectionStrings__Company2  → Monit Paper Associates DB connection string
///   Jwt__Secret                  → minimum 32-character random string
/// </summary>
public class AppConfig
{
    public string Company1ConnectionString { get; }
    public string Company2ConnectionString { get; }
    public string JwtSecret           { get; }
    public string JwtIssuer           { get; }
    public string JwtAudience         { get; }
    public int    JwtAccessExpiryHours   { get; }
    public int    JwtRefreshExpiryDays   { get; }
    public string[] CorsOrigins       { get; }
    public string CompanyName         { get; }
    public string CompanyAddress      { get; }

    public string GetConnectionString(int companyId) =>
        companyId == 2 ? Company2ConnectionString : Company1ConnectionString;

    public AppConfig(IConfiguration config)
    {
        Company1ConnectionString = config.GetConnectionString("Company1")
            ?? throw new InvalidOperationException(
               "ConnectionStrings:Company1 is not configured. " +
               "Set environment variable: ConnectionStrings__Company1");

        Company2ConnectionString = config.GetConnectionString("Company2")
            ?? throw new InvalidOperationException(
               "ConnectionStrings:Company2 is not configured. " +
               "Set environment variable: ConnectionStrings__Company2");

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
