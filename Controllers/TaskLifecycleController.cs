using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TaskLifecycleController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly ITaskTableService _tableService;
    private readonly IAppTimeService _timeService;
    private readonly UserManager<User> _userManager;
    private readonly ILogger<TaskLifecycleController> _logger;

    public TaskLifecycleController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        ITaskTableService tableService,
        IAppTimeService timeService,
        UserManager<User> userManager,
        ILogger<TaskLifecycleController> logger)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _tableService = tableService;
        _timeService = timeService;
        _userManager = userManager;
        _logger = logger;
    }

    [HttpPost("{id}/start")]
    public async Task<IActionResult> Start(
        int id,
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        return await RunLifecycle(id, "Start", async () =>
        {
            var task = await _repo.GetTaskByIdAsync(id, cancellationToken);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.StartTaskAsync(id, _timeService.Now, cancellationToken);
            return await BuildLifecycleResultAsync("Задача запущена", id, task.ParentRowNumber, employee, cancellationToken);
        });
    }

    [HttpPost("{id}/pause")]
    public async Task<IActionResult> Pause(
        int id,
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        return await RunLifecycle(id, "Pause", async () =>
        {
            var task = await _repo.GetTaskByIdAsync(id, cancellationToken);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.PauseTaskAsync(id, _timeService.Now, cancellationToken);
            return await BuildLifecycleResultAsync("Задача приостановлена", id, task.ParentRowNumber, employee, cancellationToken);
        });
    }

    [HttpPost("{id}/resume")]
    public async Task<IActionResult> Resume(
        int id,
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        return await RunLifecycle(id, "Resume", async () =>
        {
            var task = await _repo.GetTaskByIdAsync(id, cancellationToken);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.ResumeTaskAsync(id, _timeService.Now, cancellationToken);
            return await BuildLifecycleResultAsync("Задача возобновлена", id, task.ParentRowNumber, employee, cancellationToken);
        });
    }

    [HttpPost("{id}/progress")]
    public async Task<IActionResult> SetProgress(
        int id,
        [FromBody] double progress,
        CancellationToken cancellationToken)
    {
        return await RunLifecycle(id, "SetProgress", async () =>
        {
            await _lifecycle.UpdateProgressAsync(id, progress, _timeService.Now, cancellationToken);
            return Ok();
        });
    }

    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(
        int id,
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        return await RunLifecycle(id, "Complete", async () =>
        {
            var task = await _repo.GetTaskByIdAsync(id, cancellationToken);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.CompleteTaskAsync(id, _timeService.Now, cancellationToken);
            return await BuildLifecycleResultAsync("Задача завершена", id, task.ParentRowNumber, employee, cancellationToken);
        });
    }

    [HttpPost("{id}/return")]
    public async Task<IActionResult> Return(int id, CancellationToken cancellationToken)
    {
        return await RunLifecycle(id, "Return", async () =>
        {
            await _lifecycle.ReturnTaskAsync(id, _timeService.Now, cancellationToken);
            return Ok();
        });
    }

    private async Task<IActionResult> RunLifecycle(int id, string action, Func<Task<IActionResult>> handler)
    {
        try
        {
            return await handler();
        }
        catch (TaskConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Concurrency conflict in {Action} for task {Id}", action, id);
            return Conflict(new { error = ex.Message, code = "concurrency_conflict" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в {Action} для задачи {Id}", action, id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private async Task<IActionResult> BuildLifecycleResultAsync(
        string message,
        int taskId,
        int? parentRowId,
        string? employee,
        CancellationToken cancellationToken)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null) return Unauthorized();

        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        var targetEmployeeName = (isAdmin && !string.IsNullOrEmpty(employee))
            ? employee
            : currentUser.FullName;

        var taskEntity = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        var removedFromTable = taskEntity == null || taskEntity.HiddenFromTaskTable;
        TaskTableRowDto? row = null;
        if (!removedFromTable)
            row = await _tableService.GetRowDtoAsync(taskId, targetEmployeeName, isAdmin, cancellationToken);

        TaskTableRowDto? parentRow = null;
        var parentRemovedFromTable = false;
        if (parentRowId.HasValue)
        {
            var parentEntity = await _repo.GetTaskByIdAsync(parentRowId.Value, cancellationToken);
            parentRemovedFromTable = parentEntity == null || parentEntity.HiddenFromTaskTable;
            if (!parentRemovedFromTable)
            {
                parentRow = await _tableService.GetRowDtoAsync(
                    parentRowId.Value,
                    targetEmployeeName,
                    isAdmin,
                    cancellationToken);
            }
        }

        return Ok(new TaskLifecycleResultDto
        {
            Message = message,
            Row = row,
            RemovedFromTable = removedFromTable,
            ParentRowId = parentRowId,
            ParentRow = parentRow,
            ParentRemovedFromTable = parentRemovedFromTable
        });
    }
}
