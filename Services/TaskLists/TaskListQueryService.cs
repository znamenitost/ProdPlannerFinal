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

    public async Task<List<object>> GetActiveTasksAsync(
        string employee,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee, cancellationToken);
        return tasks.Select(task => MapTaskToResult(task, now)).Cast<object>().ToList();
    }

    public async Task<object> GetCompletedTasksAsync(
        string employee,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var statsRow = await _repo.GetCompletedTasksStatsAsync(employee, cancellationToken);
        var pageResult = await _repo.GetCompletedTasksPaginatedAsync(employee, page, pageSize, cancellationToken);

        var taskIds = pageResult.Items.Select(t => t.Id).ToList();
        var intervals = await _repo.GetWorkIntervalsForTaskIdsAsync(taskIds, cancellationToken);
        var intervalsByTask = intervals
            .GroupBy(i => i.ProductionTaskId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var tasks = pageResult.Items.Select(task =>
        {
            intervalsByTask.TryGetValue(task.Id, out var taskIntervals);
            return MapCompletedTaskToResult(task, taskIntervals ?? []);
        }).ToList();

        var stats = new
        {
            totalTasks = statsRow.TotalTasks,
            totalEstimate = statsRow.TotalEstimate,
            totalActual = statsRow.TotalActual
        };

        return new
        {
            tasks,
            stats,
            page = pageResult.Page,
            pageSize = pageResult.PageSize,
            totalCount = pageResult.TotalCount,
            totalPages = pageResult.TotalPages
        };
    }

    private static object MapCompletedTaskToResult(ProductionTask task, List<WorkInterval> intervals) =>
        new
        {
            task.Id,
            Title = task.TaskDisplayName,
            Heading = task.TaskDisplayName,
            FileName = task.FileName,
            FolderPath = task.FolderPath,
            File = task.FullPath ?? string.Empty,
            task.Type,
            task.Deadline,
            task.EstimateHours,
            task.ActualHours,
            task.CompletedAt,
            task.Progress,
            task.Status,
            RowNumber = task.Id,
            workIntervals = intervals.Select(i => new
            {
                i.Id,
                i.ProductionTaskId,
                startTime = i.StartTime,
                endTime = i.EndTime
            })
        };

    public async Task<List<DeadlineRisk>> GetDeadlineRisksAsync(
        string employee,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee, cancellationToken);
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
            Heading = task.TaskDisplayName,
            FileName = task.FileName,
            FolderPath = task.FolderPath,
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
