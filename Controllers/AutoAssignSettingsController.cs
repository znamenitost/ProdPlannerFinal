using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class AutoAssignSettingsController : ControllerBase
{
    private readonly IAutoAssignSettingsService _settingsService;

    public AutoAssignSettingsController(IAutoAssignSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("auto-assign")]
    public async Task<ActionResult<AutoAssignSettingsDto>> Get(CancellationToken cancellationToken)
    {
        var settings = await _settingsService.GetAsync(cancellationToken);
        return Ok(settings);
    }

    [HttpPut("auto-assign")]
    public async Task<IActionResult> Save(
        [FromBody] AutoAssignSettingsDto settings,
        CancellationToken cancellationToken)
    {
        if (settings == null)
            return BadRequest(new { error = "Настройки не переданы" });

        await _settingsService.SaveAsync(settings, cancellationToken);
        return Ok(new { saved = true });
    }
}
