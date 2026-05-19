namespace Monit.API.Models.DTOs.Mail;

public class SendMailRequestDto
{
    public List<string> To      { get; set; } = [];
    public List<string> Cc      { get; set; } = [];
    public string       Subject { get; set; } = string.Empty;
    public string       Body    { get; set; } = string.Empty;
}

public class SendMailResponseDto
{
    public bool   Success     { get; set; }
    public string EmailSentAt { get; set; } = string.Empty;
}
