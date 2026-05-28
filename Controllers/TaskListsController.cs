using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskLists;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TaskListsController : ControllerBase
{
    private readonly ITaskListQueryService _taskLists;
    private readonly IAppTimeService _timeService;
    private readonly UserManager<User> _userManager;

    public TaskListsController(
        ITaskListQueryService taskLists,
        IAppTimeService timeService,
        UserManager<User> userManager)
    {
        _taskLists = taskLists;
        _timeService = timeService;
        _userManager = userManager;
    }

    /// <summary>
    /// Сотрудник может запрашивать только свои данные; админ — кого угодно.
    /// Возвращает <c>null</c>, если доступ есть; иначе — готовый Forbid/Unauthorized.
    /// </summary>
    private async Task<IActionResult?> EnsureCanQueryEmployeeAsync(string employee)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null) return Unauthorized();

        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        if (!isAdmin && !string.Equals(employee, currentUser.FullName, StringComparison.Ordinal))
            return Forbid();

        return null;
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveTasks(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(employee))
            return BadRequest(new { error = "Employee name is required" });

        if (await EnsureCanQueryEmployeeAsync(employee) is { } denied) return denied;

        var result = await _taskLists.GetActiveTasksAsync(employee, _timeService.Now, cancellationToken);
        return Ok(result);
    }

    [HttpGet("completed")]
    public async Task<IActionResult> GetCompletedTasks(
        [FromQuery] string employee,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(employee))
            return BadRequest(new { error = "Employee name is required" });

        if (await EnsureCanQueryEmployeeAsync(employee) is { } denied) return denied;

        var result = await _taskLists.GetCompletedTasksAsync(employee, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("deadline-risks")]
    public async Task<IActionResult> GetDeadlineRisks(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(employee))
            return BadRequest(new { error = "Employee name is required" });

        if (await EnsureCanQueryEmployeeAsync(employee) is { } denied) return denied;

        var risks = await _taskLists.GetDeadlineRisksAsync(employee, _timeService.Now, cancellationToken);
        return Ok(risks);
    }

    [HttpGet("queue-overloads")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetQueueOverloads(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(employee))
            return BadRequest(new { error = "Employee name is required" });

        var overloads = await _taskLists.GetQueueOverloadsAsync(
            employee,
            _timeService.Now,
            cancellationToken);
        return Ok(overloads);
    }
}
