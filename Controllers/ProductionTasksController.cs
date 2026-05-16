using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Models;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class ProductionTasksController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly IProductionScheduler _scheduler;
    private readonly IWorkHoursCalculator _workHours;
    private readonly IAppTimeService _timeService;
    private readonly ILogger<ProductionTasksController> _logger;
    private readonly UserManager<User> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly ITaskNotificationService _notificationService;
    private readonly ITaskSplitService _splitService;

    public ProductionTasksController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours,
        IAppTimeService timeService,
        ILogger<ProductionTasksController> logger,
        UserManager<User> userManager,
        ApplicationDbContext context,
        ITaskNotificationService notificationService,
        ITaskSplitService splitService)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _scheduler = scheduler;
        _workHours = workHours;
        _timeService = timeService;
        _logger = logger;
        _userManager = userManager;
        _context = context;
        _notificationService = notificationService;
        _splitService = splitService;
    }

    [HttpGet("table")]
    public async Task<IActionResult> GetTableRows(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? employee = null)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            string targetEmployeeName = (isAdmin && !string.IsNullOrEmpty(employee))
                ? employee
                : currentUser.FullName;

            var query = _context.ProductionTasks
                .Where(t => t.ParentRowNumber == null)
                .OrderBy(t => t.DisplayOrder)
                .AsQueryable();

            var totalCount = await query.CountAsync();
            var parents = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            if (parents.Count == 0)
            {
                return Ok(new PaginatedResult<object>
                {
                    Items = new List<object>(),
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
            }

            var parentIds = parents.Select(p => p.Id).ToList();

            var allChildren = await _context.ProductionTasks
                .Where(c => c.ParentRowNumber.HasValue && 
                            parentIds.Contains(c.ParentRowNumber.Value) && 
                            c.IsSplitTask)
                .ToListAsync();

            var childrenByParent = allChildren
                .GroupBy(c => c.ParentRowNumber!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var resultItems = new List<object>();

            foreach (var parent in parents)
            {
                bool hasChildForTargetEmployee = false;
                string aggregatedStatusText = MapStatusToText(parent.Status);

                if (parent.IsSplitTask && childrenByParent.TryGetValue(parent.Id, out var children))
                {
                    hasChildForTargetEmployee = children.Any(c => 
                        c.EmployeeName == targetEmployeeName && c.Status != JobStatus.Completed);

                    if (children.All(c => c.Status == JobStatus.Completed))
                        aggregatedStatusText = "Готово";
                    else if (children.Any(c => c.Status == JobStatus.Completed || 
                                            c.Status == JobStatus.InProgress || 
                                            c.Status == JobStatus.Paused))
                        aggregatedStatusText = "Начал";
                    else
                        aggregatedStatusText = "";
                }

                resultItems.Add(new
                {
                    parent.Id,
                    parent.DisplayOrder,
                    parent.FolderPath,
                    parent.FileName,
                    parent.Comment,
                    StatusText = aggregatedStatusText,
                    parent.Deadline,
                    parent.EstimateHours,
                    parent.Type,
                    parent.EmployeeName,
                    parent.CreatedAt,
                    parent.UpdatedAt,
                    parent.ParentRowNumber,
                    parent.IsSplitTask,
                    parent.Progress,
                    HasCurrentUserSubtask = hasChildForTargetEmployee
                });
            }

            return Ok(new PaginatedResult<object>
            {
                Items = resultItems,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            });
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
            var parts = request.Parts?
                .Where(p => !string.IsNullOrWhiteSpace(p.EmployeeName) && p.AllocatedHours > 0)
                .ToList() ?? new List<SplitPart>();

            if (parts.Count >= 2)
            {
                var totalAllocated = parts.Sum(p => p.AllocatedHours);
                if (Math.Abs(totalAllocated - request.EstimateHours) > 0.01)
                    return BadRequest(new { error = $"Сумма часов по сотрудникам ({totalAllocated}) должна равняться общему времени ({request.EstimateHours})" });

                var combinedTypes = string.Join(", ",
                    parts.Select(p => p.TaskType).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct());

                var newTask = new ProductionTask
                {
                    DisplayOrder = -1,
                    FolderPath = request.FolderPath ?? "",
                    FileName = request.FileName ?? "",
                    Comment = request.Comment ?? "",
                    Deadline = request.Deadline,
                    EstimateHours = request.EstimateHours,
                    Type = string.IsNullOrWhiteSpace(combinedTypes) ? "Резка" : combinedTypes,
                    EmployeeName = "",
                    Status = JobStatus.Assigned,
                    Progress = 0,
                    ActualHours = 0,
                    ParentRowNumber = null,
                    IsSplitTask = false,
                    CreatedAt = _timeService.Now,
                    UpdatedAt = _timeService.Now
                };

                await _repo.AddTaskAsync(newTask);
                await _splitService.SplitTaskAsync(newTask.Id, parts);

                return Ok(newTask);
            }

            var singlePart = parts.Count == 1 ? parts[0] : null;
            var employeeName = singlePart?.EmployeeName ?? request.EmployeeName ?? "";
            var taskType = singlePart?.TaskType ?? request.Type ?? "Резка";
            var estimateHours = singlePart?.AllocatedHours > 0 ? singlePart.AllocatedHours : request.EstimateHours;

            var task = new ProductionTask
            {
                DisplayOrder = -1,
                FolderPath = request.FolderPath ?? "",
                FileName = request.FileName ?? "",
                Comment = request.Comment ?? "",
                Deadline = request.Deadline,
                EstimateHours = estimateHours,
                Type = taskType,
                EmployeeName = employeeName,
                Status = JobStatus.Assigned,
                Progress = 0,
                ActualHours = 0,
                ParentRowNumber = request.ParentRowNumber,
                IsSplitTask = false,
                CreatedAt = _timeService.Now,
                UpdatedAt = _timeService.Now
            };

            await _repo.AddTaskAsync(task);

            var allRootIds = (await _repo.GetRootTasksAsync()).OrderBy(t => t.DisplayOrder).Select(t => t.Id).ToList();
            await _repo.ReorderTasksAsync(allRootIds);

            await _notificationService.NotifyNewTaskAsync(task);

            return Ok(task);
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

            string oldEmployeeName = task.EmployeeName;
            // Обновляем поля
            task.FolderPath = request.FolderPath ?? task.FolderPath;
            task.FileName = request.FileName ?? task.FileName;
            task.Comment = request.Comment ?? task.Comment;
            task.Deadline = request.Deadline;
            task.EstimateHours = request.EstimateHours;
            task.Type = request.Type ?? task.Type;
            if (!(task.IsSplitTask && task.ParentRowNumber == null))
                task.EmployeeName = request.EmployeeName ?? task.EmployeeName;
            else
                task.EmployeeName = "";
            task.ParentRowNumber = request.ParentRowNumber;
            task.UpdatedAt = _timeService.Now;

            // Обновляем детей, если это сплит-родитель
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

            // Обработка изменения статуса (если нужно)
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
                    }
                }
            }

            await _repo.UpdateTaskAsync(task);

            // Уведомление об обновлении задачи
            await _notificationService.NotifyTaskUpdatedAsync(task, oldEmployeeName);

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

            var employeeNames = new HashSet<string>();
            if (!string.IsNullOrEmpty(task.EmployeeName))
                employeeNames.Add(task.EmployeeName);
            if (task.IsSplitTask)
            {
                var children = await _repo.GetChildTasksAsync(task.Id);
                foreach (var child in children)
                {
                    if (!string.IsNullOrEmpty(child.EmployeeName))
                        employeeNames.Add(child.EmployeeName);
                }
            }

            await _repo.DeleteTaskAsync(id);

            await _notificationService.NotifyTaskDeletedAsync(id, employeeNames);

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
            Title = task.TaskDisplayName,
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