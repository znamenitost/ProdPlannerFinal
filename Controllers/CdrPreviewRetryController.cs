using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class CdrPreviewRetryController : ControllerBase
{
    private readonly ICdrPreviewRetryService _retryService;

    public CdrPreviewRetryController(ICdrPreviewRetryService retryService)
    {
        _retryService = retryService;
    }

    [HttpGet("cdr-preview/pending-retries")]
    public async Task<ActionResult<IReadOnlyList<CdrPreviewRetryItemDto>>> GetPendingRetries(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var items = await _retryService.GetDueRetriesAsync(limit, cancellationToken);
        return Ok(items);
    }

    [HttpPost("{id:int}/cdr-preview/schedule-retry")]
    public async Task<IActionResult> ScheduleRetry(int id, CancellationToken cancellationToken)
    {
        var scheduled = await _retryService.ScheduleSecondAttemptAsync(id, cancellationToken);
        return Ok(new { scheduled });
    }

    [HttpPost("{id:int}/cdr-preview/retry-failed")]
    public async Task<IActionResult> RecordFailedRetry(int id, CancellationToken cancellationToken)
    {
        await _retryService.MarkAutoSearchFailedAsync(id, cancellationToken);
        return Ok(new { recorded = true });
    }
}
