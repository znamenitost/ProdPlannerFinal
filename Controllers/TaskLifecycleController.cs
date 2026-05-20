using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TaskLifecycleController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly IAppTimeService _timeService;
    private readonly ILogger<TaskLifecycleController> _logger;

    public TaskLifecycleController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IAppTimeService timeService,
        ILogger<TaskLifecycleController> logger)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _timeService = timeService;
        _logger = logger;
    }

    [HttpPost("{id}/start")]
    public async Task<IActionResult> Start(int id)
    {
        return await RunLifecycle(id, "Start", async () =>
        {
            if (await _repo.GetTaskByIdAsync(id) == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.StartTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача запущена" });
        });
    }

    [HttpPost("{id}/pause")]
    public async Task<IActionResult> Pause(int id)
    {
        return await RunLifecycle(id, "Pause", async () =>
        {
            if (await _repo.GetTaskByIdAsync(id) == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.PauseTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача приостановлена" });
        });
    }

    [HttpPost("{id}/resume")]
    public async Task<IActionResult> Resume(int id)
    {
        return await RunLifecycle(id, "Resume", async () =>
        {
            if (await _repo.GetTaskByIdAsync(id) == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.ResumeTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача возобновлена" });
        });
    }

    [HttpPost("{id}/progress")]
    public async Task<IActionResult> SetProgress(int id, [FromBody] double progress)
    {
        return await RunLifecycle(id, "SetProgress", async () =>
        {
            await _lifecycle.UpdateProgressAsync(id, progress, _timeService.Now);
            return Ok();
        });
    }

    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(int id)
    {
        return await RunLifecycle(id, "Complete", async () =>
        {
            if (await _repo.GetTaskByIdAsync(id) == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.CompleteTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача завершена" });
        });
    }

    [HttpPost("{id}/return")]
    public async Task<IActionResult> Return(int id)
    {
        return await RunLifecycle(id, "Return", async () =>
        {
            await _lifecycle.ReturnTaskAsync(id, _timeService.Now);
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
}
