using Dapper;
using Monit.API.Data;
using Monit.API.Models.Entities.Config;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Config;

public class CompanyConfigRepository(DbConnectionFactory db) : ICompanyConfigRepository
{
    private const string SelectCols = @"
        SELECT Id, CompanyName, InsurancePolicyNo, InsurancePolicyFy, InsuranceIssuer,
               SmtpSenderEmail, SmtpSenderName, SmtpAppPassword, UpdatedAt, UpdatedBy
        FROM   system.CompanyConfig";

    public async Task<List<CompanyConfig>> GetAllAsync()
    {
        using var conn = db.Create();
        return (await conn.QueryAsync<CompanyConfig>(SelectCols + " ORDER BY Id")).ToList();
    }

    public async Task<CompanyConfig> GetAsync(int id = 1)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<CompanyConfig>(
            SelectCols + " WHERE Id = @Id", new { Id = id })
            ?? new CompanyConfig { Id = id };
    }

    public async Task UpsertAsync(CompanyConfig e)
    {
        const string sql = @"
            MERGE system.CompanyConfig AS target
            USING (SELECT @Id AS Id) AS src ON target.Id = src.Id
            WHEN MATCHED THEN UPDATE SET
                CompanyName       = CASE WHEN @CompanyName       IS NULL THEN CompanyName       ELSE NULLIF(@CompanyName,       '') END,
                InsurancePolicyNo = CASE WHEN @InsurancePolicyNo IS NULL THEN InsurancePolicyNo ELSE NULLIF(@InsurancePolicyNo, '') END,
                InsurancePolicyFy = CASE WHEN @InsurancePolicyFy IS NULL THEN InsurancePolicyFy ELSE NULLIF(@InsurancePolicyFy, '') END,
                InsuranceIssuer   = CASE WHEN @InsuranceIssuer   IS NULL THEN InsuranceIssuer   ELSE NULLIF(@InsuranceIssuer,   '') END,
                SmtpSenderEmail   = CASE WHEN @SmtpSenderEmail   IS NULL THEN SmtpSenderEmail   ELSE NULLIF(@SmtpSenderEmail,   '') END,
                SmtpSenderName    = CASE WHEN @SmtpSenderName    IS NULL THEN SmtpSenderName    ELSE NULLIF(@SmtpSenderName,    '') END,
                SmtpAppPassword   = CASE WHEN @SmtpAppPassword   IS NULL THEN SmtpAppPassword   ELSE NULLIF(@SmtpAppPassword,   '') END,
                UpdatedAt         = @UpdatedAt,
                UpdatedBy         = @UpdatedBy
            WHEN NOT MATCHED THEN INSERT
                (Id, CompanyName, InsurancePolicyNo, InsurancePolicyFy, InsuranceIssuer,
                 SmtpSenderEmail, SmtpSenderName, SmtpAppPassword, UpdatedAt, UpdatedBy)
            VALUES
                (@Id, NULLIF(@CompanyName, ''), @InsurancePolicyNo, @InsurancePolicyFy, @InsuranceIssuer,
                 @SmtpSenderEmail, @SmtpSenderName, NULLIF(@SmtpAppPassword, ''), @UpdatedAt, @UpdatedBy);";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }
}
