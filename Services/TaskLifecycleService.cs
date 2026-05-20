using Microsoft.Extensions.Logging;
using ProductionPlanner.Data;
using ProductionPlanner.Models;

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
        string action)
    {
        var updated = await _repo.TryTransitionStatusAsync(
            taskId, newStatus, updatedAt, expectedStatuses, patch);

        if (updated == 0)
        {
            _logger.LogWarning(
                "Concurrency conflict on task {TaskId} for action {Action}. Expected: [{Expected}], target: {Target}",
                taskId, action, string.Join(", ", expectedStatuses), newStatus);
            throw ConcurrencyConflict(taskId, action);
        }
    }

    private async Task CloseOpenIntervalsInTransactionAsync(int taskId, DateTime closedAt)
    {
        await _repo.CloseOpenIntervalsAsync(taskId, closedAt);
    }

    private async Task UpdateParentStatusAsync(int childTaskId)
    {
        var child = await _repo.GetTaskByIdAsync(childTaskId);
        if (child?.ParentRowNumber == null) return;

        var parent = await _repo.GetTaskByIdAsync(child.ParentRowNumber.Value);
        if (parent == null || !parent.IsSplitTask) return;

        var allChildren = await _repo.GetChildTasksAsync(parent.Id);
        if (!allChildren.Any()) return;

        JobStatus newStatus;
        if (allChildren.All(c => c.Status == JobStatus.Completed))
            newStatus = JobStatus.Completed;
        else if (allChildren.Any(c => c.Status == JobStatus.Completed || c.Status == JobStatus.InProgress || c.Status == JobStatus.Paused))
            newStatus = JobStatus.InProgress;
        else
            newStatus = JobStatus.Assigned;

        if (parent.Status != newStatus)
        {
            parent.Status = newStatus;
            parent.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(parent);
        }
    }

    public async Task StartTaskAsync(int taskId, DateTime now)
    {
        var startTime = _workHours.GetNextWorkStart(now);

        await _repo.ExecuteInTransactionAsync(async () =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now);

            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.Assigned],
                JobStatus.InProgress,
                now,
                patch: null,
                action: "запуск");

            _repo.StageWorkInterval(new WorkInterval
            {
                ProductionTaskId = taskId,
                StartTime = startTime,
                EndTime = null
            });
            await _repo.SaveChangesAsync();
        });

        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null) return;

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id);

        await _notificationService.NotifyStatusChangedAsync(task, "InProgress");
    }

    public async Task PauseTaskAsync(int taskId, DateTime now)
    {
        await _repo.ExecuteInTransactionAsync(async () =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now);

            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.InProgress],
                JobStatus.Paused,
                now,
                patch: null,
                action: "пауза");
        });

        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null) return;

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id);

        await _notificationService.NotifyStatusChangedAsync(task, "Paused");
    }

    public async Task ResumeTaskAsync(int taskId, DateTime now)
    {
        var startTime = _workHours.GetNextWorkStart(now);

        await _repo.ExecuteInTransactionAsync(async () =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now);

            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.Paused],
                JobStatus.InProgress,
                now,
                patch: null,
                action: "возобновление");

            _repo.StageWorkInterval(new WorkInterval
            {
                ProductionTaskId = taskId,
                StartTime = startTime,
                EndTime = null
            });
            await _repo.SaveChangesAsync();
        });

        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null) return;

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id);

        await _notificationService.NotifyStatusChangedAsync(task, "InProgress");
    }

    public async Task UpdateProgressAsync(int taskId, double newProgress, DateTime now)
    {
        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null || task.Status == JobStatus.Completed) return;
        if (newProgress > 0.99) newProgress = 0.99;

        if (task.Status == JobStatus.Assigned && newProgress > 0)
        {
            await StartTaskAsync(taskId, now);
            task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null) return;
        }

        task.Progress = newProgress;
        task.UpdatedAt = now;

        if (task.Status == JobStatus.Assigned && newProgress > 0)
            task.Status = JobStatus.InProgress;

        await _repo.UpdateTaskAsync(task);
        await _notificationService.NotifyProgressChangedAsync(task, newProgress);
    }

    public async Task CompleteTaskAsync(int taskId, DateTime now)
    {
        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null || task.Status == JobStatus.Completed) return;

        if (task.Status == JobStatus.Assigned)
        {
            await _repo.ExecuteInTransactionAsync(async () =>
            {
                await RequireStatusTransitionAsync(
                    taskId,
                    [JobStatus.Assigned],
                    JobStatus.Completed,
                    now,
                    new TaskStatusPatch { Progress = 1, CompletedAt = now },
                    action: "завершение");
            });

            await _statsService.AddSavedHoursAsync(task.EmployeeName, task.EstimateHours, now);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await UpdateParentStatusAsync(task.Id);

            task = await _repo.GetTaskByIdAsync(taskId);
            if (task != null)
                await _notificationService.NotifyStatusChangedAsync(task, "Completed");

            await TryCompleteParentAfterChildrenAsync(taskId, now);
            return;
        }

        var actualHours = 0.0;

        await _repo.ExecuteInTransactionAsync(async () =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now);

            var intervals = (await _repo.GetTaskByIdAsync(taskId))?.WorkIntervals ?? [];
            foreach (var interval in intervals)
            {
                if (interval.EndTime.HasValue)
                    actualHours += _workHours.GetWorkHoursBetween(interval.StartTime, interval.EndTime.Value);
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
                action: "завершение");
        });

        task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null) return;

        double saved = task.EstimateHours - task.ActualHours;
        await _statsService.AddSavedHoursAsync(task.EmployeeName, saved, now);

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id);

        await TryCompleteParentAfterChildrenAsync(taskId, now);

        await _notificationService.NotifyStatusChangedAsync(task, "Completed");
    }

    private async Task TryCompleteParentAfterChildrenAsync(int taskId, DateTime now)
    {
        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task?.ParentRowNumber is not int parentId || !task.IsSplitTask)
            return;

        var allCompleted = await _splitService.AreAllSubtasksCompletedAsync(parentId);
        if (!allCompleted) return;

        var parentTask = await _repo.GetTaskByIdAsync(parentId);
        if (parentTask == null || !parentTask.IsSplitTask || parentTask.Status == JobStatus.Completed)
            return;

        var updated = await _repo.TryTransitionStatusAsync(
            parentId,
            JobStatus.Completed,
            now,
            [JobStatus.Assigned, JobStatus.InProgress, JobStatus.Paused],
            new TaskStatusPatch { Progress = 1, CompletedAt = now });

        if (updated > 0)
            _logger.LogInformation("Parent task {ParentId} marked completed after all children done", parentId);
    }

    public async Task ReturnTaskAsync(int taskId, DateTime now)
    {
        await _repo.ExecuteInTransactionAsync(async () =>
        {
            await RequireStatusTransitionAsync(
                taskId,
                [JobStatus.Completed],
                JobStatus.Assigned,
                now,
                new TaskStatusPatch { Progress = 0, ClearCompletedAt = true },
                action: "возврат в работу");
        });

        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null) return;

        await _notificationService.NotifyStatusChangedAsync(task, "Assigned");
    }
}
