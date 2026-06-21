using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.MaxMessenger;

namespace ProductionPlanner.Controllers;

[Authorize]
[ApiController]
[Route("api/me/max")]
public class MaxLinkController : ControllerBase
{
    private readonly IMaxMessengerService _max;

    public MaxLinkController(IMaxMessengerService max)
    {
        _max = max;
    }

    [HttpGet]
    public async Task<ActionResult<MaxLinkStatusDto>> GetStatus(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        return Ok(await _max.GetLinkStatusAsync(userId, cancellationToken));
    }

    [HttpPost("link-token")]
    public async Task<ActionResult<MaxLinkTokenDto>> CreateLinkToken(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        try
        {
            return Ok(await _max.CreateLinkTokenAsync(userId, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("link")]
    public async Task<IActionResult> Unlink(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        await _max.UnlinkAsync(userId, cancellationToken);
        return NoContent();
    }

    [HttpGet("subscriptions")]
    public async Task<ActionResult<MaxSubscriptionIdsDto>> GetSubscriptions(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var taskIds = await _max.GetSubscribedTaskIdsAsync(userId, cancellationToken);
        return Ok(new MaxSubscriptionIdsDto { TaskIds = taskIds });
    }
}
