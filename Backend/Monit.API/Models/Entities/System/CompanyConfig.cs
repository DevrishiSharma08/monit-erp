namespace Monit.API.Models.Entities.Config;

public class CompanyConfig
{
    public int      Id                 { get; set; } = 1;
    public string?  InsurancePolicyNo  { get; set; }
    public string?  InsurancePolicyFy  { get; set; }
    public string?  InsuranceIssuer    { get; set; }
    public DateTime? UpdatedAt         { get; set; }
    public string?   UpdatedBy         { get; set; }
}
