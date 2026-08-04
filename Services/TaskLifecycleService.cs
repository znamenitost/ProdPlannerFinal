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
        if (child?.ParentRowNumber is not int parentId) return;

        var parentProbe = await _repo.GetTaskByIdAsync(parentId, cancellationToken);
        if (parentProbe == null || !parentProbe.IsSplitTask) return;

        var parentUpdated = 0;
        await _repo.ExecuteWithTaskLifecycleLockAsync(parentId, async ct =>
        {
            var parent = await _repo.GetTaskByIdAsync(parentId, ct);
            if (parent == null || !parent.IsSplitTask) return;

            var allChildren = await _repo.GetChildTasksAsync(parent.Id, ct);
            if (!allChildren.Any()) return;

            var newStatus = SplitTaskStatusAggregator.ResolveParentStatus(allChildren);
            var now = _timeService.Now;
            var patch = SplitTaskStatusAggregator.BuildParentStatusPatch(newStatus, allChildren, now);

            if (parent.Status == newStatus)
            {
                if (newStatus == JobStatus.Completed && parent.Progress < 0.99)
                {
                    parentUpdated = await _repo.TryTransitionStatusAsync(
                        parent.Id,
                        JobStatus.Completed,
                        now,
                        expectedStatuses: [JobStatus.Completed],
                        patch,
                        ct);
                }
            }
            else
            {
                parentUpdated = await _repo.TryTransitionStatusAsync(
                    parent.Id,
                    newStatus,
                    now,
                    expectedStatuses: [parent.Status],
                    patch,
                    ct);
            }
        }, cancellationToken);

        if (parentUpdated > 0)
            await NotifySplitParentStatusChangedAsync(parentId, cancellationToken);
    }

    private async Task NotifySplitParentStatusChangedAsync(int parentId, CancellationToken cancellationToken)
    {
        var parent = await _repo.GetTaskByIdAsync(parentId, cancellationToken);
        if (parent == null || !parent.IsSplitTask)
            return;

        await _notificationService.NotifyStatusChangedAsync(
            parent,
            TaskStatusMapper.ToText(parent.Status));
    }

    public async Task StartTaskAsync(
        int taskId,
        DateTime now,
        string? comment = null,
        CancellationToken cancellationToken = default)
    {
        var startTime = _workHours.GetNextWorkStart(now);
        var trimmedComment = comment?.Trim();

        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            var task = await _repo.GetTaskByIdAsync(taskId, ct);
            if (task == null)
                throw new InvalidOperationException($"Задача с id {taskId} не найдена");

            if (task.IsFuss)
            {
                if (string.IsNullOrWhiteSpace(trimmedComment))
                    throw new InvalidOperationException("Для «Суеты» укажите комментарий перед стартом.");

                task.Comment = trimmedComment;
                task.CommentEditedViaDialog = true;
                task.FolderPath = "";
                task.FileName = string.IsNullOrWhiteSpace(task.EmployeeName)
                    ? "Суета"
                    : $"Суета ({task.EmployeeName.Trim()})";
                task.UpdatedAt = now;
                await _repo.UpdateTaskTableFieldsAsync(task, cancellationToken: ct);

                if (task.Status == JobStatus.Completed)
                {
                    await RequireStatusTransitionAsync(
                        taskId,
                        [JobStatus.Completed],
                        JobStatus.Assigned,
                        now,
                        new TaskStatusPatch { Progress = 0, ClearCompletedAt = true },
                        action: "новый цикл суеты",
                        ct);
                }
            }

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

        var started = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (started == null) return;

        if (started.ParentRowNumber.HasValue && started.IsSplitTask)
            await UpdateParentStatusAsync(started.Id, cancellationToken);

        await _notificationService.NotifyStatusChangedAsync(started, "InProgress");
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

    public async Task PauseOpenTasksAtEndOfWorkDayAsync(
        DateTime workDayEnd,
        CancellationToken cancellationToken = default)
    {
        var taskIds = await _repo.GetTaskIdsWithOpenWorkIntervalsAsync(cancellationToken);
        foreach (var taskId in taskIds)
        {
            var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
            if (task == null) continue;

            if (task.Status == JobStatus.InProgress)
            {
                await PauseTaskAsync(taskId, workDayEnd, cancellationToken);
                continue;
            }

            // Тот же lifecycle-lock, что у Start/Resume: иначе параллельный старт
            // может открыть новый интервал рядом с «закрытием» конца дня.
            await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
            {
                await _repo.CloseOpenIntervalsAsync(taskId, workDayEnd, ct);
            }, cancellationToken);
        }
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
        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            var task = await _repo.GetTaskByIdAsync(taskId, ct);
            if (task == null || task.Status == JobStatus.Completed) return;
            if (newProgress > 0.99) newProgress = 0.99;

            // Симметрично со StartTaskAsync: «стартовые» статусы — Assigned/Approved/InStock.
            // Без этого % > 0 для Approved/InStock записывались бы в задачу, оставляя её
            // без открытого WorkInterval — задача с прогрессом, но без отметки начала работы.
            if (newProgress > 0
                && !task.IsFuss
                && task.Status is JobStatus.Assigned or JobStatus.Approved or JobStatus.InStock)
            {
                await StartTaskAsync(taskId, now, cancellationToken: ct);
                task = await _repo.GetTaskByIdAsync(taskId, ct);
                if (task == null) return;
            }

            var updated = await _repo.TryUpdateProgressAsync(taskId, newProgress, now, ct);
            if (updated == 0)
                return;

            await _notificationService.NotifyProgressChangedAsync(task, newProgress);
        }, cancellationToken);
    }

    public async Task CompleteTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null || task.Status == JobStatus.Completed) return;

        if (TestPhaseWorkflow.IsActiveTestPhase(task))
        {
            await CompleteTestPhaseAsync(taskId, now, cancellationToken);
            return;
        }

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

            var estimateForStats = TestPhaseWorkflow.IsProductionPhase(task)
                ? task.ProductionEstimateHours
                : task.EstimateHours;
            if (!task.IsFuss)
                await _statsService.AddSavedHoursAsync(task.EmployeeName, estimateForStats, now);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await UpdateParentStatusAsync(task.Id, cancellationToken);

            task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
            if (task != null)
            {
                if (TestPhaseWorkflow.IsProductionPhase(task))
                    task.WorkPhase = TaskWorkPhase.Done;
                await _repo.UpdateTaskAsync(task, cancellationToken);
                await _notificationService.NotifyStatusChangedAsync(task, "Completed");
            }

            await TryCompleteParentAfterChildrenAsync(taskId, now, cancellationToken);
            await TryAdvanceSequentialStageAsync(taskId, cancellationToken);
            return;
        }

        var actualHours = 0.0;

        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

            var lockedTask = await _repo.GetTaskByIdAsync(taskId, ct, includeIntervals: true);
            if (lockedTask == null)
                return;

            actualHours = TestPhaseWorkflow.SumAllClosedWorkHours(
                lockedTask,
                lockedTask.WorkIntervals,
                (start, end) => _workHours.GetWorkHoursBetween(
                    AppDateTime.ToMoscowWallClockFromDb(start),
                    AppDateTime.ToMoscowWallClockFromDb(end)));

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

        var allIntervals = (await _repo.GetTaskByIdAsync(taskId, cancellationToken, includeIntervals: true))
            ?.WorkIntervals ?? [];
        var phaseEstimate = TestPhaseWorkflow.GetActiveEstimateHours(task);
        var completionIntervals = TestPhaseWorkflow.GetIntervalsForCompletion(task, allIntervals);
        var completionHours = TestPhaseWorkflow.SumClosedWorkHours(
            completionIntervals,
            (start, end) => _workHours.GetWorkHoursBetween(
                AppDateTime.ToMoscowWallClockFromDb(start),
                AppDateTime.ToMoscowWallClockFromDb(end)));
        double saved = phaseEstimate - completionHours;
        if (!task.IsFuss)
            await _statsService.AddSavedHoursAsync(task.EmployeeName, saved, now);

        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            await UpdateParentStatusAsync(task.Id, cancellationToken);

        if (TestPhaseWorkflow.IsProductionPhase(task))
        {
            task.WorkPhase = TaskWorkPhase.Done;
            await _repo.UpdateTaskAsync(task, cancellationToken);
        }

        await _notificationService.NotifyStatusChangedAsync(task, "Completed");

        await TryCompleteParentAfterChildrenAsync(taskId, now, cancellationToken);
        await TryAdvanceSequentialStageAsync(taskId, cancellationToken);
    }

    private async Task CompleteTestPhaseAsync(
        int taskId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var completed = false;
        var testSaved = 0.0;
        string? employeeName = null;

        // Статус + WorkPhase меняем под lifecycle-lock, иначе два параллельных
        // «Готово» оба проходят IsActiveTestPhase и дважды начисляют saved hours.
        await _repo.ExecuteWithTaskLifecycleLockAsync(taskId, async ct =>
        {
            var task = await _repo.GetTaskByIdAsync(taskId, ct, includeIntervals: true);
            if (task == null || !TestPhaseWorkflow.IsActiveTestPhase(task))
                return;

            await CloseOpenIntervalsInTransactionAsync(taskId, now, ct);

            task = await _repo.GetTaskByIdAsync(taskId, ct, includeIntervals: true);
            if (task == null || !TestPhaseWorkflow.IsActiveTestPhase(task))
                return;

            var actualHours = 0.0;
            foreach (var interval in task.WorkIntervals ?? [])
            {
                if (interval.EndTime.HasValue)
                {
                    actualHours += _workHours.GetWorkHoursBetween(
                        AppDateTime.ToMoscowWallClockFromDb(interval.StartTime),
                        AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value));
                }
            }

            testSaved = task.TestEstimateHours - actualHours;
            employeeName = task.EmployeeName;

            task.Status = JobStatus.PendingApproval;
            task.WorkPhase = TaskWorkPhase.AwaitingApproval;
            task.Progress = 0;
            task.ActualHours = actualHours;
            task.TestPhaseCompletedAt = now;
            task.CompletedAt = null;
            task.UpdatedAt = now;
            await _repo.UpdateTaskAsync(task, ct);
            completed = true;
        }, cancellationToken);

        if (!completed || employeeName == null)
            return;

        await _statsService.AddSavedHoursAsync(employeeName, testSaved, now);

        var updatedTask = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (updatedTask == null) return;

        if (updatedTask.ParentRowNumber.HasValue && updatedTask.IsSplitTask)
            await UpdateParentStatusAsync(updatedTask.Id, cancellationToken);

        await _notificationService.NotifyStatusChangedAsync(updatedTask, "PendingApproval");
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

        var updated = 0;
        await _repo.ExecuteWithTaskLifecycleLockAsync(parentId, async ct =>
        {
            var allCompleted = await _splitService.AreAllSubtasksCompletedAsync(parentId, ct);
            if (!allCompleted) return;

            var parentTask = await _repo.GetTaskByIdAsync(parentId, ct);
            if (parentTask == null || !parentTask.IsSplitTask || parentTask.Status == JobStatus.Completed)
                return;

            updated = await _repo.TryTransitionStatusAsync(
                parentId,
                JobStatus.Completed,
                now,
                [JobStatus.Assigned, JobStatus.InProgress, JobStatus.Paused],
                new TaskStatusPatch { Progress = 1, CompletedAt = now },
                ct);
        }, cancellationToken);

        if (updated > 0)
        {
            _logger.LogInformation("Parent task {ParentId} marked completed after all children done", parentId);
            await NotifySplitParentStatusChangedAsync(parentId, cancellationToken);
        }
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
