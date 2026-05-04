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
    private readonly ISyncService _syncService;
    private readonly ITableRowRepository _tableRepo;

    public ProductionTasksController(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours,
        ITaskSplitService splitService,
        ISyncService syncService,
        ITableRowRepository tableRepo)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _scheduler = scheduler;
        _workHours = workHours;
        _splitService = splitService;
        _syncService = syncService;
        _tableRepo = tableRepo;
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveTasks([FromQuery] string employee)
    {
        await _syncService.SyncTasksFromTable();
        
        var allTasks = await _repo.GetAllTasksAsync();
        var allTableRows = await _tableRepo.GetAllRowsAsync();
        
        var result = new List<object>();
        
        foreach (var task in allTasks.Where(t => t.EmployeeName == employee))
        {
            if (task.Status == JobStatus.Completed) continue;
            
            var tableRow = allTableRows.FirstOrDefault(r => r.Id == task.RowNumber);
            if (tableRow == null)
            {
                result.Add(MapTaskToResult(task));
                continue;
            }
            
            if (tableRow.StatusText == "Готово") continue;
            if (tableRow.StatusText != null && tableRow.StatusText.StartsWith("Разделена")) continue;
            
            bool isParentTask = allTableRows.Any(r => r.ParentRowNumber == tableRow.Id);
            if (isParentTask) continue;
            
            result.Add(MapTaskToResult(task));
        }
        
        return Ok(result);
    }

    private object MapTaskToResult(ProductionTask task)
    {
        var now = AppTime.Now;
        var hoursNeeded = task.EstimateHours * (1 - task.Progress);
        var workHoursUntilDeadline = _workHours.GetWorkHoursBetween(now, task.Deadline);
        
        string riskLevel = "ok";
        if (task.Deadline < now) riskLevel = "overdue";
        else if (workHoursUntilDeadline < hoursNeeded) riskLevel = "critical";
        else if (workHoursUntilDeadline < hoursNeeded + 2) riskLevel = "warning";
        
        return new
        {
            task.Id,
            task.Title,
            task.File,
            task.Type,
            task.Deadline,
            task.EstimateHours,
            task.Progress,
            task.Status,
            task.RowNumber,
            RiskLevel = riskLevel
        };
    }

    [HttpGet("completed")]
    public async Task<IActionResult> GetCompletedTasks([FromQuery] string employee)
    {
        await _syncService.SyncTasksFromTable();
        
        var allTasks = await _repo.GetAllTasksAsync();
        var allTableRows = await _tableRepo.GetAllRowsAsync();
        
        var completedTasks = new List<ProductionTask>();
        
        foreach (var task in allTasks.Where(t => t.EmployeeName == employee && t.Status == JobStatus.Completed))
        {
            var tableRow = allTableRows.FirstOrDefault(r => r.Id == task.RowNumber);
            bool isParentTask = false;
            if (tableRow != null)
            {
                isParentTask = allTableRows.Any(r => r.ParentRowNumber == tableRow.Id);
            }
            if (!isParentTask)
            {
                completedTasks.Add(task);
            }
        }
        
        var stats = new
        {
            totalTasks = completedTasks.Count,
            totalEstimate = completedTasks.Sum(t => t.EstimateHours),
            totalActual = completedTasks.Sum(t => t.ActualHours)
        };
        
        return Ok(new { tasks = completedTasks, stats });
    }

    [HttpPost("{id}/start")]
    public async Task<IActionResult> Start(int id)
    {
        var now = AppTime.Now;
        await _lifecycle.StartTaskAsync(id, now);
        return Ok();
    }

    [HttpPost("{id}/progress")]
    public async Task<IActionResult> SetProgress(int id, [FromBody] double progress)
    {
        var now = AppTime.Now;
        await _lifecycle.UpdateProgressAsync(id, progress, now);
        return Ok();
    }

    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(int id)
    {
        var now = AppTime.Now;
        await _lifecycle.CompleteTaskAsync(id, now);
        return Ok();
    }

    [HttpPost("{id}/return")]
    public async Task<IActionResult> Return(int id)
    {
        var now = AppTime.Now;
        await _lifecycle.ReturnTaskAsync(id, now);
        return Ok();
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync()
    {
        await _syncService.SyncTasksFromTable();
        return Ok(new { message = "Синхронизация завершена" });
    }

    [HttpPost("shift")]
    public async Task<IActionResult> ShiftTasks([FromQuery] string employee)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee);
        var tomorrow = AppTime.Now.Date.AddDays(1);
        var nextWorkStart = _workHours.GetNextWorkStart(tomorrow);

        foreach (var task in tasks.Where(t => t.Status == JobStatus.Assigned))
        {
            foreach (var interval in task.WorkIntervals.ToList())
                await _repo.DeleteWorkIntervalAsync(interval);
            await _repo.UpdateTaskAsync(task);
        }
        return Ok();
    }

    [HttpGet("deadline-risks")]
    public async Task<IActionResult> GetDeadlineRisks([FromQuery] string employee)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee);
        var now = AppTime.Now;
        var risks = _scheduler.CheckDeadlineRisks(tasks, now);
        return Ok(risks);
    }
}