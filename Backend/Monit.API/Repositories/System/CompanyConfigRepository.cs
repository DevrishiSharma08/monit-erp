using Dapper;
using Monit.API.Data;
using Monit.API.Models.Entities.Config;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Config;

public class CompanyConfigRepository(DbConnectionFactory db) : ICompanyConfigRepository
{
    public async Task<CompanyConfig> GetAsync()
    {
        const string sql = @"
            SELECT Id, InsurancePolicyNo, InsurancePolicyFy, InsuranceIssuer, UpdatedAt, UpdatedBy
            FROM   system.CompanyConfig
            WHERE  Id = 1";
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<CompanyConfig>(sql)
            ?? new CompanyConfig();
    }

    public async Task UpsertAsync(CompanyConfig e)
    {
        const string sql = @"
            MERGE system.CompanyConfig AS target
            USING (SELECT 1 AS Id) AS src ON target.Id = src.Id
            WHEN MATCHED THEN UPDATE SET
                InsurancePolicyNo = @InsurancePolicyNo,
                InsurancePolicyFy = @InsurancePolicyFy,
                InsuranceIssuer   = @InsuranceIssuer,
                UpdatedAt         = @UpdatedAt,
                UpdatedBy         = @UpdatedBy
            WHEN NOT MATCHED THEN INSERT
                (Id, InsurancePolicyNo, InsurancePolicyFy, InsuranceIssuer, UpdatedAt, UpdatedBy)
            VALUES
                (1, @InsurancePolicyNo, @InsurancePolicyFy, @InsuranceIssuer, @UpdatedAt, @UpdatedBy);";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, e);
    }
}
