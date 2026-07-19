using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class FileOpenSettingsController : ControllerBase
{
    private readonly IFileOpenSettingsService _settingsService;

    public FileOpenSettingsController(IFileOpenSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("file-open")]
    public async Task<ActionResult<FileOpenSettingsDto>> Get(CancellationToken cancellationToken)
    {
        return Ok(await _settingsService.GetAsync(cancellationToken));
    }

    [HttpPut("file-open")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Save(
        [FromBody] FileOpenSettingsDto settings,
        CancellationToken cancellationToken)
    {
        if (settings == null)
            return BadRequest(new { error = "Настройки не переданы" });

        try
        {
            await _settingsService.SaveAsync(settings, cancellationToken);
            return Ok(new { saved = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
