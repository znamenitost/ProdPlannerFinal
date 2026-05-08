using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Models;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
public class ProductionTasksController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly IProductionScheduler _scheduler;
    private readonly IWorkHoursCalculator _workHours;
    private readonly ITaskSplitService _splitService;
    private readonly IAppTimeService _timeService;
    private readonly ILogger<ProductionTasksController> _logger;

    public ProductionTasksController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours,
        ITaskSplitService splitService,
        IAppTimeService timeService,
        ILogger<ProductionTasksController> logger)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _scheduler = scheduler;
        _workHours = workHours;
        _splitService = splitService;
        _timeService = timeService;
        _logger = logger;
    }

    [HttpGet("table")]
    public async Task<IActionResult> GetTableRows()
    {
        try
        {
            var allTasks = await _repo.GetAllTasksAsync();
            var rootTasks = allTasks.Where(t => t.ParentRowNumber == null).OrderBy(t => t.DisplayOrder);
            var result = rootTasks.Select(parent => new
            {
                parent.Id,
                parent.DisplayOrder,
                parent.FolderPath,
                parent.FileName,
                parent.Comment,
                StatusText = MapStatusToText(parent.Status),
                parent.Deadline,
                parent.EstimateHours,
                parent.Type,
                parent.EmployeeName,
                parent.CreatedAt,
                parent.UpdatedAt,
                parent.ParentRowNumber,
                parent.IsSplitTask,
                parent.Progress,
                Children = allTasks
                    .Where(c => c.ParentRowNumber == parent.Id && c.IsSplitTask)
                    .OrderBy(c => c.DisplayOrder)
                    .Select(c => new
                    {
                        c.Id,
                        c.FolderPath,
                        c.FileName,
                        c.Comment,
                        StatusText = MapStatusToText(c.Status),
                        c.Deadline,
                        c.EstimateHours,
                        c.Type,
                        c.EmployeeName,
                        c.IsSplitTask,
                        c.Progress
                    }).ToList()
            });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetTableRows");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/row")]
    public async Task<IActionResult> CreateTableRow([FromBody] CreateTaskRequest request)
    {
        try
        {
            var newTask = new ProductionTask
            {
                DisplayOrder = -1,
                FolderPath = request.FolderPath ?? "",
                FileName = request.FileName ?? "",
                Comment = request.Comment ?? "",
                Deadline = request.Deadline,
                EstimateHours = request.EstimateHours,
                Type = request.Type ?? "Резка",
                EmployeeName = request.EmployeeName ?? "Дима",
                Status = JobStatus.Assigned,
                Progress = 0,
                ActualHours = 0,
                ParentRowNumber = request.ParentRowNumber,
                IsSplitTask = false,
                CreatedAt = _timeService.Now,
                UpdatedAt = _timeService.Now
            };
            await _repo.AddTaskAsync(newTask);
            var allRootIds = (await _repo.GetRootTasksAsync()).OrderBy(t => t.DisplayOrder).Select(t => t.Id).ToList();
            await _repo.ReorderTasksAsync(allRootIds);
            return Ok(newTask);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в CreateTableRow");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("table/row/{id}")]
    public async Task<IActionResult> UpdateTableRow(int id, [FromBody] UpdateTaskRequest request)
    {
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null) return NotFound();

            task.FolderPath = request.FolderPath ?? task.FolderPath;
            task.FileName = request.FileName ?? task.FileName;
            task.Comment = request.Comment ?? task.Comment;
            task.Deadline = request.Deadline;
            task.EstimateHours = request.EstimateHours;
            task.Type = request.Type ?? task.Type;
            task.EmployeeName = request.EmployeeName ?? task.EmployeeName;
            task.ParentRowNumber = request.ParentRowNumber;
            task.UpdatedAt = _timeService.Now;

            // Если это родительская разделённая задача, обновляем дедлайн у всех дочерних
            if (task.IsSplitTask && task.ParentRowNumber == null)
            {
                var childTasks = await _repo.GetChildTasksAsync(task.Id);
                foreach (var child in childTasks)
                {
                    child.Deadline = request.Deadline;
                    child.UpdatedAt = _timeService.Now;
                    await _repo.UpdateTaskAsync(child);
                }
            }

            if (!string.IsNullOrEmpty(request.StatusText))
            {
                var newStatus = MapStatusFromText(request.StatusText);
                if (newStatus != task.Status)
                {
                    if (newStatus == JobStatus.Completed && task.Status != JobStatus.Completed)
                        await _lifecycle.CompleteTaskAsync(task.Id, _timeService.Now);
                    else
                    {
                        task.Status = newStatus;
                        await _repo.UpdateTaskAsync(task);
                    }
                }
            }
            else
                await _repo.UpdateTaskAsync(task);

            return Ok(task);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в UpdateTableRow для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("table/row/{id}")]
    public async Task<IActionResult> DeleteTableRow(int id)
    {
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null) return NotFound();
            await _repo.DeleteTaskAsync(id);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в DeleteTableRow для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/reorder")]
    public async Task<IActionResult> ReorderRows([FromBody] List<int> orderedIds)
    {
        try
        {
            await _repo.ReorderTasksAsync(orderedIds);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в ReorderRows");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveTasks([FromQuery] string employee)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var allTasks = await _repo.GetAllTasksAsync();
            var now = _timeService.Now;
            var result = new List<object>();

            foreach (var task in allTasks.Where(t => t.EmployeeName == employee && t.Status != JobStatus.Completed))
            {
                if (task.IsSplitTask && task.ParentRowNumber == null) continue;
                result.Add(MapTaskToResult(task, now));
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetActiveTasks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("completed")]
    public async Task<IActionResult> GetCompletedTasks([FromQuery] string employee)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var allTasks = await _repo.GetAllTasksAsync();
            var completedTasks = allTasks
                .Where(t => t.EmployeeName == employee && t.Status == JobStatus.Completed
                            && !(t.IsSplitTask && t.ParentRowNumber == null))
                .ToList();

            var stats = new
            {
                totalTasks = completedTasks.Count,
                totalEstimate = completedTasks.Sum(t => t.EstimateHours),
                totalActual = completedTasks.Sum(t => t.ActualHours)
            };
            return Ok(new { tasks = completedTasks, stats });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetCompletedTasks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/start")]
    public async Task<IActionResult> Start(int id)
    {
        try
        {
            var task = await _repo.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound(new { error = $"Задача с id {id} не найдена" });

            if (task.Status != JobStatus.Assigned && task.Status != JobStatus.Paused)
                return BadRequest(new { error = $"Задача уже в статусе {task.Status}" });

            await _lifecycle.StartTaskAsync(id, _timeService.Now);
            return Ok(new { message = "Задача запущена" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в Start для задачи {Id}", id);
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

    [HttpPost("shift")]
    public async Task<IActionResult> ShiftTasks([FromQuery] string employee)
    {
        try
        {
            var tasks = await _repo.GetActiveTasksAsync(employee);
            var tomorrow = _timeService.Now.Date.AddDays(1);
            var nextWorkStart = _workHours.GetNextWorkStart(tomorrow);
            foreach (var task in tasks.Where(t => t.Status == JobStatus.Assigned))
            {
                foreach (var interval in task.WorkIntervals.ToList())
                    await _repo.DeleteWorkIntervalAsync(interval);
                await _repo.UpdateTaskAsync(task);
            }
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в ShiftTasks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("deadline-risks")]
    public async Task<IActionResult> GetDeadlineRisks([FromQuery] string employee)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var tasks = await _repo.GetActiveTasksAsync(employee);
            var now = _timeService.Now;
            var risks = _scheduler.CheckDeadlineRisks(tasks, now);
            return Ok(risks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetDeadlineRisks для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private object MapTaskToResult(ProductionTask task, DateTime now)
    {
        var hoursNeeded = task.EstimateHours * (1 - task.Progress);
        var workHoursUntilDeadline = _workHours.GetWorkHoursBetween(now, task.Deadline);
        string riskLevel = "ok";
        if (task.Deadline < now) riskLevel = "overdue";
        else if (workHoursUntilDeadline < hoursNeeded) riskLevel = "critical";
        else if (workHoursUntilDeadline < hoursNeeded + 2) riskLevel = "warning";

        return new
        {
            task.Id,
            Title = task.FileName ?? string.Empty,
            File = task.FullPath ?? string.Empty,
            task.Type,
            task.Deadline,
            task.EstimateHours,
            task.Progress,
            task.Status,
            RowNumber = task.Id,
            RiskLevel = riskLevel
        };
    }

    private string MapStatusToText(JobStatus status) => status switch
    {
        JobStatus.Assigned => "",
        JobStatus.InProgress => "Начал",
        JobStatus.Paused => "Пауза",
        JobStatus.Completed => "Готово",
        _ => ""
    };

    private JobStatus MapStatusFromText(string statusText) => statusText switch
    {
        "Готово" => JobStatus.Completed,
        "Начал" => JobStatus.InProgress,
        "Пауза" => JobStatus.Paused,
        _ => JobStatus.Assigned
    };
}

public class CreateTaskRequest
{
    public string? FolderPath { get; set; }
    public string? FileName { get; set; }
    public string? Comment { get; set; }
    public DateTime Deadline { get; set; }
    public double EstimateHours { get; set; }
    public string? Type { get; set; }
    public string? EmployeeName { get; set; }
    public int? ParentRowNumber { get; set; }
}

public class UpdateTaskRequest
{
    public string? FolderPath { get; set; }
    public string? FileName { get; set; }
    public string? Comment { get; set; }
    public DateTime Deadline { get; set; }
    public double EstimateHours { get; set; }
    public string? Type { get; set; }
    public string? EmployeeName { get; set; }
    public int? ParentRowNumber { get; set; }
    public string? StatusText { get; set; }
}