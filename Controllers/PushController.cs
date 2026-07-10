using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/push")]
public class PushController : ControllerBase
{
    private readonly IWebPushService _push;
    private readonly WebPushOptions _options;

    public PushController(IWebPushService push, IOptions<WebPushOptions> options)
    {
        _push = push;
        _options = options.Value;
    }

    [HttpGet("config")]
    [AllowAnonymous]
    public IActionResult GetConfig()
    {
        if (!_options.IsConfigured)
            return Ok(new WebPushConfigDto());

        return Ok(new WebPushConfigDto { PublicKey = _options.PublicKey });
    }

    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest request, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        if (!_options.IsConfigured)
            return BadRequest(new { message = "Web Push не настроен на сервере." });

        await _push.SaveSubscriptionAsync(userId, request.Endpoint, request.P256dh, request.Auth, ct);
        return NoContent();
    }

    [HttpPost("unsubscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeRequest request, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        await _push.RemoveSubscriptionAsync(userId, request.Endpoint, ct);
        return NoContent();
    }

    private string? CurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);
}
