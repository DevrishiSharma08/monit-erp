namespace Monit.API.Models.DTOs.Config;

public class CompanyConfigDto
{
    public string?   InsurancePolicyNo  { get; set; }
    public string?   InsurancePolicyFy  { get; set; }
    public string?   InsuranceIssuer    { get; set; }
    public DateTime? UpdatedAt          { get; set; }
    public string?   UpdatedBy          { get; set; }
}

public class UpdateCompanyConfigDto
{
    public string? InsurancePolicyNo  { get; set; }
    public string? InsurancePolicyFy  { get; set; }
    public string? InsuranceIssuer    { get; set; }
}
