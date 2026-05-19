namespace Monit.API.Models.DTOs.Config;

public class CompanyConfigDto
{
    public string?   InsurancePolicyNo  { get; set; }
    public string?   InsurancePolicyFy  { get; set; }
    public string?   InsuranceIssuer    { get; set; }
    public string?   SmtpSenderEmail    { get; set; }
    public string?   SmtpSenderName     { get; set; }
    public bool      SmtpConfigured     { get; set; }   // true when email+password are set
    public DateTime? UpdatedAt          { get; set; }
    public string?   UpdatedBy          { get; set; }
}

public class UpdateCompanyConfigDto
{
    public string? InsurancePolicyNo  { get; set; }
    public string? InsurancePolicyFy  { get; set; }
    public string? InsuranceIssuer    { get; set; }
    public string? SmtpSenderEmail    { get; set; }
    public string? SmtpSenderName     { get; set; }
    // Empty string = clear password; null = keep existing
    public string? SmtpAppPassword    { get; set; }
}
