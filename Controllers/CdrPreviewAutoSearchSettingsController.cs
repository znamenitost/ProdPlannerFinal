using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Roles = "Admin")]
public class CdrPreviewAutoSearchSettingsController : ControllerBase
{
    private readonly ICdrPreviewAutoSearchSettingsService _settingsService;

    public CdrPreviewAutoSearchSettingsController(ICdrPreviewAutoSearchSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("cdr-preview-autosearch")]
    public async Task<ActionResult<CdrPreviewAutoSearchSettingsDto>> Get(CancellationToken cancellationToken)
    {
        return Ok(await _settingsService.GetAsync(cancellationToken));
    }

    [HttpPut("cdr-preview-autosearch")]
    public async Task<IActionResult> Save(
        [FromBody] CdrPreviewAutoSearchSettingsDto settings,
        CancellationToken cancellationToken)
    {
        if (settings == null)
            return BadRequest(new { error = "Настройки не переданы" });

        await _settingsService.SaveAsync(settings, cancellationToken);
        return Ok(new { saved = true });
    }
}
