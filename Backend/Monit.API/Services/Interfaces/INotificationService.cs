using Monit.API.Models.DTOs.Notif;

namespace Monit.API.Services.Interfaces;

public interface INotificationService
{
    Task<List<NotificationDto>> GetForUserAsync(int userId);
    Task MarkReadAsync(int userId, string key);
    Task MarkAllReadAsync(int userId, IEnumerable<string> keys);
    Task DismissAsync(int userId, string key);
    Task DismissAllAsync(int userId, IEnumerable<string> keys);
}
