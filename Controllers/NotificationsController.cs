using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationInboxService _inbox;

    public NotificationsController(INotificationInboxService inbox)
    {
        _inbox = inbox;
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var pending = await _inbox.GetPendingAsync(userId);
        return Ok(pending);
    }

    [HttpPost("{id:long}/ack")]
    public async Task<IActionResult> Acknowledge(long id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var ok = await _inbox.AcknowledgeAsync(userId, id);
        if (!ok)
            return NotFound();

        return NoContent();
    }
}
