using Monit.API.Models.DTOs.Notif;
using Monit.API.Repositories.Interfaces;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.System;

public class NotificationService(INotificationRepository repo) : INotificationService
{
    public Task<List<NotificationDto>> GetForUserAsync(int userId)
        => repo.GetForUserAsync(userId);

    public Task MarkReadAsync(int userId, string key)
        => repo.MarkReadAsync(userId, key);

    public Task MarkAllReadAsync(int userId, IEnumerable<string> keys)
        => repo.MarkAllReadAsync(userId, keys);

    public Task DismissAsync(int userId, string key)
        => repo.DismissAsync(userId, key);

    public Task DismissAllAsync(int userId, IEnumerable<string> keys)
        => repo.DismissAllAsync(userId, keys);
}
