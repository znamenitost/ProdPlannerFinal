using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskTable;

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
        var childTaskIds = tasks
            .Where(task => task.IsSplitTask && task.ParentRowNumber.HasValue)
            .Select(task => task.Id)
            .ToList();
        var splitMetadataByChild = await _repo.GetTaskSplitMetadataByChildTaskIdsAsync(childTaskIds, cancellationToken);

        return tasks
            .Select(task =>
            {
                splitMetadataByChild.TryGetValue(task.Id, out var splitMetadata);
                return MapTaskToResult(task, now, splitMetadata);
            })
            .Cast<object>()
            .ToList();
    }

    public async Task<object> GetCompletedTasksAsync(
        string employee,
        int page,
        int pageSize,
        string statsPeriod,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var (statsFrom, statsTo, normalizedStatsPeriod) = GetStatsPeriodRange(statsPeriod, now);
        var statsRow = await _repo.GetCompletedTasksStatsAsync(employee, statsFrom, statsTo, cancellationToken);
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
            totalActual = statsRow.TotalActual,
            period = normalizedStatsPeriod
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

    private static (DateTime? From, DateTime? To, string Period) GetStatsPeriodRange(string? statsPeriod, DateTime now)
    {
        var normalizedPeriod = (statsPeriod ?? "week").Trim().ToLowerInvariant();
        return normalizedPeriod switch
        {
            "day" => (now.Date, now.Date.AddDays(1), "day"),
            "all" => (null, null, "all"),
            _ => (GetCurrentWorkWeekStart(now), GetCurrentWorkWeekStart(now).AddDays(5), "week")
        };
    }

    private static DateTime GetCurrentWorkWeekStart(DateTime now)
    {
        var daysSinceMonday = ((int)now.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return now.Date.AddDays(-daysSinceMonday);
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
            StatusText = TaskStatusMapper.ToText(task.Status),
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

    public async Task<List<QueueOverloadAlert>> GetQueueOverloadsAsync(
        string employee,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var tasks = await _repo.GetActiveTasksAsync(employee, cancellationToken);
        return _scheduler.CheckQueueOverloads(tasks, now);
    }

    private object MapTaskToResult(
        ProductionTask task,
        DateTime now,
        (SupplyMode SupplyMode, int SequenceOrder) splitMetadata = default)
    {
        var (riskLevel, _, _) = DeadlineRiskEvaluator.Evaluate(task, now, _workHours);
        var supplyMode = splitMetadata.SupplyMode != default ? splitMetadata.SupplyMode : task.SupplyMode;
        var sequenceOrder = splitMetadata.SequenceOrder;

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
            task.IsSplitTask,
            SupplyMode = supplyMode,
            SequenceOrder = sequenceOrder,
            SequenceStartBlocked = supplyMode == SupplyMode.InternalProduction && task.Status == JobStatus.Waiting,
            StatusText = TaskStatusMapper.ToText(task.Status),
            RowNumber = task.Id,
            RiskLevel = riskLevel
        };
    }
}
