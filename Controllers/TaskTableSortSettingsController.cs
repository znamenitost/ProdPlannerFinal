using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class TaskTableSortSettingsController : ControllerBase
{
    private readonly ITaskTableSortSettingsService _settingsService;

    public TaskTableSortSettingsController(ITaskTableSortSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("task-table-sort")]
    public async Task<ActionResult<TaskTableSortSettingsDto?>> Get(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var settings = await _settingsService.GetForUserAsync(userId, cancellationToken);
        return Ok(settings);
    }

    [HttpPut("task-table-sort")]
    public async Task<IActionResult> Save(
        [FromBody] TaskTableSortSettingsDto settings,
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        if (settings == null)
            return BadRequest(new { error = "Настройки не переданы" });

        await _settingsService.SaveForUserAsync(userId, settings, cancellationToken);
        return Ok(new { saved = true });
    }
}
