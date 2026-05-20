namespace Monit.API.Models.DTOs.Notif;

public class NotificationDto
{
    public string Key       { get; set; } = string.Empty;
    public string Type      { get; set; } = string.Empty;
    public string Title     { get; set; } = string.Empty;
    public string Body      { get; set; } = string.Empty;
    public string RefNumber { get; set; } = string.Empty;
    public string Href      { get; set; } = string.Empty;
    public bool   IsRead    { get; set; }
    public string NotifTs   { get; set; } = string.Empty;
}
