using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.LabelPrint;

namespace ProductionPlanner.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/print-agent")]
public class PrintAgentController : ControllerBase
{
    private readonly ILabelPrintService _print;
    private readonly IOptions<PrintAgentOptions> _options;

    public PrintAgentController(ILabelPrintService print, IOptions<PrintAgentOptions> options)
    {
        _print = print;
        _options = options;
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        if (!PrintAgentAuth.IsAuthorized(Request, _options))
            return Unauthorized();

        return Ok(new { ok = true, feature = "print-agent" });
    }

    [HttpGet("jobs/pending")]
    public async Task<ActionResult<IReadOnlyList<PrintJobDto>>> Pending(CancellationToken cancellationToken)
    {
        if (!PrintAgentAuth.IsAuthorized(Request, _options))
            return Unauthorized();

        return Ok(await _print.GetPendingJobsAsync(cancellationToken));
    }

    [HttpPost("jobs/{id:int}/claim")]
    public async Task<ActionResult<PrintJobDto>> Claim(
        int id,
        [FromBody] PrintJobStatusUpdateDto? body,
        CancellationToken cancellationToken)
    {
        if (!PrintAgentAuth.IsAuthorized(Request, _options))
            return Unauthorized();

        var job = await _print.ClaimJobAsync(id, body?.AgentName, cancellationToken);
        if (job == null)
            return Conflict(new { message = "Задание уже взято или не найдено" });

        return Ok(job);
    }

    [HttpPost("jobs/{id:int}/printing")]
    public async Task<IActionResult> Printing(
        int id,
        [FromBody] PrintJobStatusUpdateDto? body,
        CancellationToken cancellationToken)
    {
        if (!PrintAgentAuth.IsAuthorized(Request, _options))
            return Unauthorized();

        if (!await _print.MarkPrintingAsync(id, body?.AgentName, cancellationToken))
            return NotFound();

        return Ok();
    }

    [HttpPost("jobs/{id:int}/printed")]
    public async Task<IActionResult> Printed(
        int id,
        [FromBody] PrintJobStatusUpdateDto? body,
        CancellationToken cancellationToken)
    {
        if (!PrintAgentAuth.IsAuthorized(Request, _options))
            return Unauthorized();

        if (!await _print.MarkPrintedAsync(id, body?.AgentName, cancellationToken))
            return NotFound();

        return Ok();
    }

    [HttpPost("jobs/{id:int}/failed")]
    public async Task<IActionResult> Failed(
        int id,
        [FromBody] PrintJobStatusUpdateDto? body,
        CancellationToken cancellationToken)
    {
        if (!PrintAgentAuth.IsAuthorized(Request, _options))
            return Unauthorized();

        if (!await _print.MarkFailedAsync(id, body?.AgentName, body?.ErrorMessage, cancellationToken))
            return NotFound();

        return Ok();
    }
}
