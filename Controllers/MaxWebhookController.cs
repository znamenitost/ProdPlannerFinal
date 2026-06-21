using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using ProductionPlanner.Services.MaxMessenger;

namespace ProductionPlanner.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/max")]
public class MaxWebhookController : ControllerBase
{
    private readonly IMaxMessengerService _max;
    private readonly MaxBotOptions _options;
    private readonly ILogger<MaxWebhookController> _logger;

    public MaxWebhookController(
        IMaxMessengerService max,
        IOptions<MaxBotOptions> options,
        ILogger<MaxWebhookController> logger)
    {
        _max = max;
        _options = options.Value;
        _logger = logger;
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook([FromBody] JsonElement update, CancellationToken cancellationToken)
    {
        if (_options.IsConfigured && !string.IsNullOrWhiteSpace(_options.WebhookSecret))
        {
            var secret = Request.Headers["X-Max-Bot-Api-Secret"].FirstOrDefault();
            if (!string.Equals(secret, _options.WebhookSecret, StringComparison.Ordinal))
            {
                _logger.LogWarning("MAX webhook: неверный X-Max-Bot-Api-Secret");
                return Unauthorized();
            }
        }

        try
        {
            await _max.HandleUpdateAsync(update, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MAX webhook: ошибка обработки update");
        }

        return Ok(new { ok = true });
    }
}
