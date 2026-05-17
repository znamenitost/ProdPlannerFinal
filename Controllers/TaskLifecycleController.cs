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
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            if (task.Status != JobStatus.Assigned)
                return BadRequest(new { error = $"Задача уже в статусе {task.Status}. Используйте /resume для паузы." });

            await _lifecycle.StartTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача запущена" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в Start для задачи {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/pause")]
    public async Task<IActionResult> Pause(int id)
    {
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            if (task.Status != JobStatus.InProgress)
                return BadRequest(new { error = $"Невозможно поставить на паузу задачу в статусе {task.Status}" });

            await _lifecycle.PauseTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача приостановлена" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в Pause для задачи {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/resume")]
    public async Task<IActionResult> Resume(int id)
    {
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            if (task.Status != JobStatus.Paused)
                return BadRequest(new { error = $"Невозможно возобновить задачу в статусе {task.Status}" });

            await _lifecycle.ResumeTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача возобновлена" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в Resume для задачи {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/progress")]
    public async Task<IActionResult> SetProgress(int id, [FromBody] double progress)
    {
        try
        {
            await _lifecycle.UpdateProgressAsync(id, progress, _timeService.Now);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в SetProgress для задачи {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(int id)
    {
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            await _lifecycle.CompleteTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача завершена" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в Complete для задачи {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/return")]
    public async Task<IActionResult> Return(int id)
    {
        try
        {
            await _lifecycle.ReturnTaskAsync(id, _timeService.Now);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в Return для задачи {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
