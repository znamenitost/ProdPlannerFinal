using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/lunch")]
[Authorize]
public class LunchController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly IAppTimeService _timeService;
    private readonly UserManager<User> _userManager;

    public LunchController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IAppTimeService timeService,
        UserManager<User> userManager)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _timeService = timeService;
        _userManager = userManager;
    }

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent(
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        var targetEmployee = await ResolveTargetEmployeeAsync(employee);
        if (targetEmployee == null)
            return Forbid();

        var openInterval = await _repo.GetOpenLunchIntervalAsync(targetEmployee, cancellationToken);
        return Ok(openInterval == null ? null : LunchIntervalDto.FromEntity(openInterval));
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start(
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        var targetEmployee = await ResolveTargetEmployeeAsync(employee);
        if (targetEmployee == null)
            return Forbid();

        var openInterval = await _repo.GetOpenLunchIntervalAsync(targetEmployee, cancellationToken);
        if (openInterval != null)
            return Ok(LunchIntervalDto.FromEntity(openInterval));

        var now = _timeService.Now;
        var activeTasks = await _repo.GetActiveTasksAsync(targetEmployee, cancellationToken);
        foreach (var task in activeTasks.Where(t => t.Status == JobStatus.InProgress))
        {
            await _lifecycle.PauseTaskAsync(task.Id, now, cancellationToken);
        }

        var interval = new LunchInterval
        {
            EmployeeName = targetEmployee,
            StartTime = now,
            EndTime = null
        };
        await _repo.AddLunchIntervalAsync(interval, cancellationToken);
        return Ok(LunchIntervalDto.FromEntity(interval));
    }

    [HttpPost("end")]
    public async Task<IActionResult> End(
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        var targetEmployee = await ResolveTargetEmployeeAsync(employee);
        if (targetEmployee == null)
            return Forbid();

        await _repo.CloseOpenLunchIntervalsAsync(targetEmployee, _timeService.Now, cancellationToken);
        return Ok();
    }

    private async Task<string?> ResolveTargetEmployeeAsync(string? employee)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null)
            return null;

        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        if (isAdmin && !string.IsNullOrWhiteSpace(employee))
            return employee.Trim();

        if (string.IsNullOrWhiteSpace(currentUser.FullName))
            return null;

        if (!string.IsNullOrWhiteSpace(employee)
            && !string.Equals(employee.Trim(), currentUser.FullName, StringComparison.Ordinal))
        {
            return null;
        }

        return currentUser.FullName;
    }
}
