namespace Monit.API.Models.Entities.Config;

public class CompanyConfig
{
    public int      Id                 { get; set; } = 1;
    public string?  CompanyName        { get; set; }
    public string?  InsurancePolicyNo  { get; set; }
    public string?  InsurancePolicyFy  { get; set; }
    public string?  InsuranceIssuer    { get; set; }
    // SMTP email config (stored in DB so it's editable from Company Settings UI)
    public string?  SmtpSenderEmail    { get; set; }
    public string?  SmtpSenderName     { get; set; }
    public string?  SmtpAppPassword    { get; set; }
    public DateTime? UpdatedAt         { get; set; }
    public string?   UpdatedBy         { get; set; }
}
