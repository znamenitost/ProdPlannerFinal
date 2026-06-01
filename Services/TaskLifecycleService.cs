using Microsoft.Extensions.Logging;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Services;

public class TaskLifecycleService : ITaskLifecycleService
{
    private readonly IProductionTaskRepository _repo;
    private readonly IEmployeeStatsService _statsService;
    private readonly IWorkHoursCalculator _workHours;
    private readonly ITaskSplitService _splitService;
    private readonly IAppTimeService _timeService;
    private readonly ITaskNotificationService _notificationService;
    private readonly ILogger<TaskLifecycleService> _logger;

    private static readonly JobStatus[] WorkingStatuses =
        [JobStatus.InProgress, JobStatus.Paused];

    public TaskLifecycleService(
        IProductionTaskRepository repo,
        IEmployeeStatsService statsService,
        IWorkHoursCalculator workHours,
        ITaskSplitService splitService,
        IAppTimeService timeService,
        ITaskNotificationService notificationService,
        ILogger<TaskLifecycleService> logger)
    {
        _repo = repo;
        _statsService = statsService;
        _workHours = workHours;
        _splitService = splitService;
        _timeService = timeService;
        _notificationService = notificationService;
        _logger = logger;
    }

    private static TaskConcurrencyException ConcurrencyConflict(int taskId, string action) =>
        new(taskId, $"Не удалось выполнить «{action}»: задача уже изменена другим действием. Обновите список и повторите.");

    private async Task RequireStatusTransitionAsync(
        int taskId,
        IReadOnlyList<JobStatus> expectedStatuses,
        JobStatus newStatus,
        DateTime updatedAt,
        TaskStatusPatch? patch,
        string action,
        CancellationToken cancellationToken)
    {
        var updated = await _repo.TryTransitionStatusAsync(
            taskId, newStatus, updatedAt, expectedStatuses, patch, cancellationToken);

        if (updated == 0)
        {
            _logger.LogWarning(
                "Concurrency conflict on task {TaskId} for action {Action}. Expected: [{Expected}], target: {Target}",
                taskId, action, string.Join(", ", expectedStatuses), newStatus);
            throw ConcurrencyConflict(taskId, action);
        }
    }

    private async Task CloseOpenIntervalsInTransactionAsync(
        int taskId,
        DateTime closedAt,
        CancellationToken cancellationToken)
    {
        await _repo.CloseOpenIntervalsAsync(taskId, closedAt, cancellationToken);
    }

    private async Task UpdateParentStatusAsync(int childTaskId, CancellationToken cancellationToken)
    {
        var child = await _repo.GetTaskByIdAsync(childTaskId, cancellationToken);
        if (child?.ParentRowNumber == null) return;

        var parent = await _repo.GetTaskByIdAsync(child.ParentRowNumber.Value, cancellationToken);
        if (parent == null || !parent.IsSplitTask) return;

        var allChildren = await _repo.GetChildTasksAsync(parent.Id, cancellationToken);
        if (!allChildren.Any()) return;

        JobStatus newStatus;
        if (allChildren.All(c => c.Status == JobStatus.Completed))
            newStatus = JobStatus.Completed;
        else if (allChildren.Any(c => c.Status == JobStatus.Completed || c.Status == JobStatus.InProgress || c.Status == JobStatus.Paused))
            newStatus = JobStatus.InProgress;
        else
            newStatus = JobStatus.Assigned;

        var now = _timeService.Now;
        var patch = newStatus == JobStatus.Completed
            ? new TaskStatusPatch { Progress = 1, CompletedAt = now }
            : new TaskStatusPatch { Progress = 0, ClearCompletedAt = true };

        if (parent.Status == newStatus)
        {
            if (newStatus == JobStatus.Completed && parent.Progress < 0.99)
            {
                await _repo.TryTransitionStatusAsync(
                    parent.Id,
                    JobStatus.Completed,
                    now,
                    expectedStatuses: null,
                    patch,
                    cancellationToken);
            }

            return;
        }

        await _repo.TryTransitionStatusAsync(
            parent.Id,
            newStatus,
            now,
            expectedStatuses: null,
            patch,
            cancellationToken);
    }

    public async Task StartTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default)
    {
        var startTime = _workHours.GetNextWorkStart(now);

        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.Assigned, JobStatus.Approved, JobStatus.InStock],
                JobStatus.InProgress,
                now,
                patch: null,
                action: "запуск",
                ct);

            _repo.StageWorkInterval(new WorkInterval
            {
                ProductionTaskId = taskId,
                StartTime = startTime,
                EndTime = null
            });
            await _repo.SaveChangesAsync(ct);
        }, cancellationToken);

        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null) return;

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id, cancellationToken);

        await _notificationService.NotifyStatusChangedAsync(task, "InProgress");
    }

    public async Task PauseTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default)
    {
        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.InProgress],
                JobStatus.Paused,
                now,
                patch: null,
                action: "пауза",
                ct);
        }, cancellationToken);

        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null) return;

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id, cancellationToken);

        await _notificationService.NotifyStatusChangedAsync(task, "Paused");
    }

    public async Task ResumeTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default)
    {
        var startTime = _workHours.GetNextWorkStart(now);

        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.Paused],
                JobStatus.InProgress,
                now,
                patch: null,
                action: "возобновление",
                ct);

            _repo.StageWorkInterval(new WorkInterval
            {
                ProductionTaskId = taskId,
                StartTime = startTime,
                EndTime = null
            });
            await _repo.SaveChangesAsync(ct);
        }, cancellationToken);

        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null) return;

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id, cancellationToken);

        await _notificationService.NotifyStatusChangedAsync(task, "InProgress");
    }

    public async Task UpdateProgressAsync(
        int taskId,
        double newProgress,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null || task.Status == JobStatus.Completed) return;
        if (newProgress > 0.99) newProgress = 0.99;

        // Симметрично со StartTaskAsync: «стартовые» статусы — Assigned/Approved/InStock.
        // Без этого % > 0 для Approved/InStock записывались бы в задачу, оставляя её
        // без открытого WorkInterval — задача с прогрессом, но без отметки начала работы.
        if (newProgress > 0
            && task.Status is JobStatus.Assigned or JobStatus.Approved or JobStatus.InStock)
        {
            await StartTaskAsync(taskId, now, cancellationToken);
            task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
            if (task == null) return;
        }

        task.Progress = newProgress;
        task.UpdatedAt = now;

        await _repo.UpdateTaskAsync(task, cancellationToken);
        await _notificationService.NotifyProgressChangedAsync(task, newProgress);
    }

    public async Task CompleteTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null || task.Status == JobStatus.Completed) return;

        if (task.Status is JobStatus.Assigned or JobStatus.Approved or JobStatus.InStock)
        {
            await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
            {
                await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

                await RequireStatusTransitionAsync(
                    taskId,
                    [JobStatus.Assigned, JobStatus.Approved, JobStatus.InStock],
                    JobStatus.Completed,
                    now,
                    new TaskStatusPatch { Progress = 1, CompletedAt = now },
                    action: "завершение",
                    ct);
            }, cancellationToken);

            await _statsService.AddSavedHoursAsync(task.EmployeeName, task.EstimateHours, now);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await UpdateParentStatusAsync(task.Id, cancellationToken);

            task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
            if (task != null)
                await _notificationService.NotifyStatusChangedAsync(task, "Completed");

            await TryCompleteParentAfterChildrenAsync(taskId, now, cancellationToken);
            await TryAdvanceSequentialStageAsync(taskId, cancellationToken);
            return;
        }

        var actualHours = 0.0;

        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

            var intervals = (await _repo.GetTaskByIdAsync(taskId, ct, includeIntervals: true))?.WorkIntervals ?? [];
            foreach (var interval in intervals)
            {
                if (interval.EndTime.HasValue)
                {
                    actualHours += _workHours.GetWorkHoursBetween(
                        AppDateTime.ToMoscowWallClockFromDb(interval.StartTime),
                        AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value));
                }
            }

            await RequireStatusTransitionAsync(
                taskId,
                WorkingStatuses,
                JobStatus.Completed,
                now,
                new TaskStatusPatch
                {
                    Progress = 1,
                    CompletedAt = now,
                    ActualHours = actualHours
                },
                action: "завершение",
                ct);
        }, cancellationToken);

        task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null) return;

        double saved = task.EstimateHours - task.ActualHours;
        await _statsService.AddSavedHoursAsync(task.EmployeeName, saved, now);

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id, cancellationToken);

        await TryCompleteParentAfterChildrenAsync(taskId, now, cancellationToken);
        await TryAdvanceSequentialStageAsync(taskId, cancellationToken);

        await _notificationService.NotifyStatusChangedAsync(task, "Completed");
    }

    private async Task TryAdvanceSequentialStageAsync(
        int completedChildId,
        CancellationToken cancellationToken)
    {
        var task = await _repo.GetTaskByIdAsync(completedChildId, cancellationToken);
        if (task?.ParentRowNumber is not int parentId || !task.IsSplitTask)
            return;

        await _splitService.AdvanceSequentialStageAsync(parentId, cancellationToken);
        await UpdateParentStatusAsync(completedChildId, cancellationToken);
    }

    private async Task TryCompleteParentAfterChildrenAsync(
        int taskId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task?.ParentRowNumber is not int parentId || !task.IsSplitTask)
            return;

        var allCompleted = await _splitService.AreAllSubtasksCompletedAsync(parentId, cancellationToken);
        if (!allCompleted) return;

        var parentTask = await _repo.GetTaskByIdAsync(parentId, cancellationToken);
        if (parentTask == null || !parentTask.IsSplitTask || parentTask.Status == JobStatus.Completed)
            return;

        var updated = await _repo.TryTransitionStatusAsync(
            parentId,
            JobStatus.Completed,
            now,
            [JobStatus.Assigned, JobStatus.InProgress, JobStatus.Paused],
            new TaskStatusPatch { Progress = 1, CompletedAt = now },
            cancellationToken);

        if (updated > 0)
            _logger.LogInformation("Parent task {ParentId} marked completed after all children done", parentId);
    }

    public async Task ReturnTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default)
    {
        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.Completed],
                JobStatus.Assigned,
                now,
                new TaskStatusPatch { Progress = 0, ClearCompletedAt = true },
                action: "возврат в работу",
                ct);
        }, cancellationToken);

        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null) return;

        await _notificationService.NotifyStatusChangedAsync(task, "Assigned");
    }

    public Task SyncSplitParentStatusAsync(int childTaskId, CancellationToken cancellationToken = default) =>
        UpdateParentStatusAsync(childTaskId, cancellationToken);
}
