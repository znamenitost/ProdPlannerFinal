using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.MaxMessenger;

namespace ProductionPlanner.Controllers;

[Authorize]
[ApiController]
[Route("api/tasks")]
public class TaskMaxSubscriptionController : ControllerBase
{
    private readonly IMaxMessengerService _max;

    public TaskMaxSubscriptionController(IMaxMessengerService max)
    {
        _max = max;
    }

    [HttpGet("{id:int}/max-subscription")]
    public async Task<ActionResult<TaskMaxSubscriptionDto>> Get(int id, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var subscribed = await _max.IsSubscribedAsync(userId, id, cancellationToken);
        return Ok(new TaskMaxSubscriptionDto { TaskId = id, Subscribed = subscribed });
    }

    [HttpPost("{id:int}/max-subscription")]
    public async Task<IActionResult> Subscribe(int id, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        try
        {
            await _max.SubscribeAsync(userId, id, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}/max-subscription")]
    public async Task<IActionResult> Unsubscribe(int id, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        await _max.UnsubscribeAsync(userId, id, cancellationToken);
        return NoContent();
    }
}
