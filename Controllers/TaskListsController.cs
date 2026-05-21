using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    private readonly ILogger<TaskListsController> _logger;

    public TaskListsController(
        ITaskListQueryService taskLists,
        IAppTimeService timeService,
        ILogger<TaskListsController> logger)
    {
        _taskLists = taskLists;
        _timeService = timeService;
        _logger = logger;
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveTasks(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var result = await _taskLists.GetActiveTasksAsync(employee, _timeService.Now, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetActiveTasks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("completed")]
    public async Task<IActionResult> GetCompletedTasks(
        [FromQuery] string employee,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var result = await _taskLists.GetCompletedTasksAsync(employee, page, pageSize, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetCompletedTasks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("deadline-risks")]
    public async Task<IActionResult> GetDeadlineRisks(
        [FromQuery] string employee,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var risks = await _taskLists.GetDeadlineRisksAsync(employee, _timeService.Now, cancellationToken);
            return Ok(risks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetDeadlineRisks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
