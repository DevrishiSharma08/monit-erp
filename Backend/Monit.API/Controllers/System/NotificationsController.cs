using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Notif;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Notif;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public class NotificationsController(INotificationService svc, ILogger<NotificationsController> logger) : ControllerBase
{
    private int CurrentUserId =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

    // GET api/v1/notifications
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            return Ok(ApiResponse<List<NotificationDto>>.Ok(await svc.GetForUserAsync(CurrentUserId)));
        }
        catch (Exception ex) when (ex is Microsoft.Data.SqlClient.SqlException or TimeoutException)
        {
            logger.LogWarning("Notifications DB unavailable for user {UserId}: {Message}", CurrentUserId, ex.Message);
            return Ok(ApiResponse<List<NotificationDto>>.Ok([]));
        }
    }

    // POST api/v1/notifications/{key}/read
    [HttpPost("{key}/read")]
    public async Task<IActionResult> MarkRead(string key)
    {
        await svc.MarkReadAsync(CurrentUserId, key);
        return Ok(ApiResponse.Ok("Marked as read."));
    }

    // POST api/v1/notifications/read-all   body: ["SO-1","PO-2",...]
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead([FromBody] List<string> keys)
    {
        await svc.MarkAllReadAsync(CurrentUserId, keys);
        return Ok(ApiResponse.Ok("All marked as read."));
    }

    // DELETE api/v1/notifications/{key}
    [HttpDelete("{key}")]
    public async Task<IActionResult> Dismiss(string key)
    {
        await svc.DismissAsync(CurrentUserId, key);
        return Ok(ApiResponse.Ok("Dismissed."));
    }

    // DELETE api/v1/notifications   body: ["SO-1","PO-2",...]
    [HttpDelete]
    public async Task<IActionResult> DismissAll([FromBody] List<string> keys)
    {
        await svc.DismissAllAsync(CurrentUserId, keys);
        return Ok(ApiResponse.Ok("All dismissed."));
    }
}
