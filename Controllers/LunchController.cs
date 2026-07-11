using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Infrastructure;
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
    private readonly ITaskDataSyncHubBroadcaster _dataSync;
    private readonly IHubContext<NotificationHub> _hubContext;

    public LunchController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IAppTimeService timeService,
        UserManager<User> userManager,
        ITaskDataSyncHubBroadcaster dataSync,
        IHubContext<NotificationHub> hubContext)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _timeService = timeService;
        _userManager = userManager;
        _dataSync = dataSync;
        _hubContext = hubContext;
    }

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent(
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        var targetEmployee = await ResolveTargetEmployeeAsync(employee);
        if (targetEmployee == null)
            return Forbid();

        var openInterval = await GetOpenLunchOrAutoCloseStaleAsync(targetEmployee, cancellationToken);
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

        // Сначала снимем «залипший» обед после 19:00, иначе Start вернёт старый интервал.
        var openInterval = await GetOpenLunchOrAutoCloseStaleAsync(targetEmployee, cancellationToken);
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
        var dto = LunchIntervalDto.FromEntity(interval);
        await NotifyLunchStateChangedAsync(targetEmployee, dto, cancellationToken);
        return Ok(dto);
    }

    [HttpPost("end")]
    public async Task<IActionResult> End(
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        var targetEmployee = await ResolveTargetEmployeeAsync(employee);
        if (targetEmployee == null)
            return Forbid();

        // Задачи, поставленные на паузу при старте обеда, остаются на паузе —
        // сотрудник сам нажимает «Начал» / «Продолжить».
        await _repo.CloseOpenLunchIntervalsAsync(targetEmployee, _timeService.Now, cancellationToken);
        await NotifyLunchStateChangedAsync(targetEmployee, null, cancellationToken);
        return Ok();
    }

    /// <summary>
    /// Если обед не закрыт пользователем до 19:00 дня начала — закрываем сами
    /// (страховка на случай простоя background-сервиса).
    /// </summary>
    private async Task<LunchInterval?> GetOpenLunchOrAutoCloseStaleAsync(
        string employeeName,
        CancellationToken cancellationToken)
    {
        var openInterval = await _repo.GetOpenLunchIntervalAsync(employeeName, cancellationToken);
        if (openInterval == null)
            return null;

        var now = _timeService.Now;
        var start = AppDateTime.ToMoscowWallClockFromDb(openInterval.StartTime);
        if (!EndOfWorkDaySchedule.IsOpenLunchPastWorkDayEnd(start, now))
            return openInterval;

        var closedAt = EndOfWorkDaySchedule.GetWorkDayEnd(start);
        await _repo.CloseOpenLunchIntervalsAsync(employeeName, closedAt, cancellationToken);
        await NotifyLunchStateChangedAsync(employeeName, null, cancellationToken);
        return null;
    }

    private async Task NotifyLunchStateChangedAsync(
        string employeeName,
        LunchIntervalDto? interval,
        CancellationToken cancellationToken)
    {
        await _dataSync.BroadcastAsync(
            "LunchStateChanged",
            [employeeName],
            employeeName,
            interval);

        var user = await _userManager.Users.FirstOrDefaultAsync(
            u => u.FullName == employeeName,
            cancellationToken);
        if (user == null)
            return;

        await _hubContext.Clients.Group(user.Id).SendAsync(
            "LunchStateChanged",
            employeeName,
            interval);
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
