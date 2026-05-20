using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Services.TaskLists;

public class TaskListQueryService : ITaskListQueryService
{
    private readonly IProductionTaskRepository _repo;
    private readonly IProductionScheduler _scheduler;
    private readonly IWorkHoursCalculator _workHours;

    public TaskListQueryService(
        IProductionTaskRepository repo,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours)
    {
        _repo = repo;
        _scheduler = scheduler;
        _workHours = workHours;
    }

    public async Task<List<object>> GetActiveTasksAsync(string employee, DateTime now)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee);
        return tasks.Select(task => MapTaskToResult(task, now)).Cast<object>().ToList();
    }

    public async Task<object> GetCompletedTasksAsync(string employee)
    {
        var completedTasks = await _repo.GetCompletedTasksAsync(employee);
        completedTasks = completedTasks
            .Where(t => !(t.IsSplitTask && t.ParentRowNumber == null))
            .ToList();

        var stats = new
        {
            totalTasks = completedTasks.Count,
            totalEstimate = completedTasks.Sum(t => t.EstimateHours),
            totalActual = completedTasks.Sum(t => t.ActualHours)
        };

        return new { tasks = completedTasks, stats };
    }

    public async Task<List<DeadlineRisk>> GetDeadlineRisksAsync(string employee, DateTime now)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee);
        return _scheduler.CheckDeadlineRisks(tasks, now);
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
}
