using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskLists;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TaskListsController : ControllerBase
{
    private readonly ITaskListQueryService _taskLists;
    private readonly IEmployeeAssignmentLoadService _assignmentLoad;
    private readonly ITaskTableService _tableService;
    private readonly IAppTimeService _timeService;
    private readonly UserManager<User> _userManager;

    public TaskListsController(
        ITaskListQueryService taskLists,
        IEmployeeAssignmentLoadService assignmentLoad,
        ITaskTableService tableService,
        IAppTimeService timeService,
        UserManager<User> userManager)
    {
        _taskLists = taskLists;
        _assignmentLoad = assignmentLoad;
        _tableService = tableService;
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

        var requestedEmployee = employee.Trim();
        var currentUserEmployee = string.IsNullOrWhiteSpace(currentUser.FullName)
            ? string.Empty
            : currentUser.FullName.Trim();
        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        if (!isAdmin && !string.Equals(requestedEmployee, currentUserEmployee, StringComparison.Ordinal))
            return Forbid();

        return null;
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveTasks(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employee))
            return BadRequest(new { error = "Employee name is required" });
        var normalizedEmployee = employee.Trim();

        if (await EnsureCanQueryEmployeeAsync(normalizedEmployee) is { } denied) return denied;

        await _tableService.EnsureFussTaskAsync(normalizedEmployee, cancellationToken);
        var result = await _taskLists.GetActiveTasksAsync(normalizedEmployee, _timeService.Now, cancellationToken);
        return Ok(result);
    }

    [HttpGet("completed")]
    public async Task<IActionResult> GetCompletedTasks(
        [FromQuery] string employee,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string statsPeriod = "week",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(employee))
            return BadRequest(new { error = "Employee name is required" });
        var normalizedEmployee = employee.Trim();

        if (await EnsureCanQueryEmployeeAsync(normalizedEmployee) is { } denied) return denied;

        var result = await _taskLists.GetCompletedTasksAsync(normalizedEmployee, page, pageSize, statsPeriod, _timeService.Now, cancellationToken);
        return Ok(result);
    }

    [HttpGet("daily-report")]
    public async Task<IActionResult> GetDailyWorkReport(
        [FromQuery] string employee,
        [FromQuery] string? date,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employee))
            return BadRequest(new { error = "Employee name is required" });
        var normalizedEmployee = employee.Trim();

        if (await EnsureCanQueryEmployeeAsync(normalizedEmployee) is { } denied) return denied;

        DateTime? reportDate = null;
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!DateTime.TryParseExact(
                    date.Trim(),
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var parsed))
            {
                return BadRequest(new { error = "date must be yyyy-MM-dd" });
            }

            reportDate = parsed;
        }

        var result = await _taskLists.GetDailyWorkReportAsync(
            normalizedEmployee,
            _timeService.Now,
            reportDate,
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("deadline-risks")]
    public async Task<IActionResult> GetDeadlineRisks(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employee))
            return BadRequest(new { error = "Employee name is required" });
        var normalizedEmployee = employee.Trim();

        if (await EnsureCanQueryEmployeeAsync(normalizedEmployee) is { } denied) return denied;

        var risks = await _taskLists.GetDeadlineRisksAsync(normalizedEmployee, _timeService.Now, cancellationToken);
        return Ok(risks);
    }

    /// <summary>
    /// Число активных незаблокированных задач по сотрудникам (для авто-выбора в модалке назначений).
    /// </summary>
    [HttpGet("assignment-load")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAssignmentLoad(
        [FromQuery] string employees,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employees))
            return BadRequest(new { error = "employees query is required" });

        var names = employees
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (names.Count == 0)
            return BadRequest(new { error = "employees query is required" });

        var counts = await _assignmentLoad.GetActiveTaskCountsAsync(names, cancellationToken);
        return Ok(new { taskCounts = counts });
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
