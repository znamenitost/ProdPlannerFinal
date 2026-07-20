using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Services.TaskTable;

public class TaskTableService : ITaskTableService
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly IAppTimeService _timeService;
    private readonly ITaskNotificationService _notificationService;
    private readonly ITaskSplitService _splitService;
    private readonly IWorkHoursCalculator _workHours;
    private readonly IEmployeeStatsService _statsService;
    private readonly ITaskCdrPreviewService _cdrPreviewService;
    private readonly ITaskCommentService _taskComments;

    public TaskTableService(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IAppTimeService timeService,
        ITaskNotificationService notificationService,
        ITaskSplitService splitService,
        IWorkHoursCalculator workHours,
        IEmployeeStatsService statsService,
        ITaskCdrPreviewService cdrPreviewService,
        ITaskCommentService taskComments)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _timeService = timeService;
        _notificationService = notificationService;
        _splitService = splitService;
        _workHours = workHours;
        _statsService = statsService;
        _cdrPreviewService = cdrPreviewService;
        _taskComments = taskComments;
    }

    /// <summary>
    /// Признак, что у задачи есть «история работы» — закрытые/открытые интервалы или активный статус.
    /// Используется при удалении и смене сотрудника, чтобы решить, можно ли физически удалить запись
    /// или нужно сохранить её как Completed для статистики.
    /// </summary>
    private static bool HasWorkHistory(ProductionTask task) =>
        (task.WorkIntervals?.Count ?? 0) > 0
        || task.Status is JobStatus.InProgress or JobStatus.Paused;

    private static bool ShouldKeepInCompletedStackOnDelete(ProductionTask task) =>
        (task.WorkIntervals?.Count ?? 0) > 0
        || task.Status is not (JobStatus.Assigned or JobStatus.Waiting);

    private static (string? ViewerEmployeeName, bool RestrictToViewer) GetPriorityMarkScope(
        string targetEmployeeName,
        bool viewerIsAdmin) =>
        viewerIsAdmin
            ? (null, false)
            : (targetEmployeeName, true);

    public async Task<PaginatedResult<TaskTableRowDto>> GetRowsAsync(
        int page,
        int pageSize,
        string targetEmployeeName,
        bool excludeCompleted = false,
        string? search = null,
        bool viewerIsAdmin = true,
        string? viewerUserId = null,
        CancellationToken cancellationToken = default)
    {
        var pageResult = await _repo.GetRootTasksPaginatedAsync(
            page,
            pageSize,
            excludeCompleted,
            search,
            cancellationToken);

        if (pageResult.Items.Count == 0)
        {
            return new PaginatedResult<TaskTableRowDto>
            {
                Items = new List<TaskTableRowDto>(),
                TotalCount = pageResult.TotalCount,
                Page = pageResult.Page,
                PageSize = pageResult.PageSize
            };
        }

        var parentIds = pageResult.Items.Select(p => p.Id).ToList();
        var childrenByParent = await _repo.GetSplitChildrenByParentIdsAsync(parentIds, cancellationToken);
        var intervalsByTask = (await _repo.GetWorkIntervalsForTaskIdsAsync(parentIds, cancellationToken))
            .GroupBy(i => i.ProductionTaskId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<WorkInterval>)g.ToList());
        var allChildIds = childrenByParent.Values
            .SelectMany(children => children.Select(c => c.Id))
            .Distinct()
            .ToList();
        var childIntervalsByTask = allChildIds.Count == 0
            ? new Dictionary<int, IReadOnlyList<WorkInterval>>()
            : (await _repo.GetWorkIntervalsForTaskIdsAsync(allChildIds, cancellationToken))
                .GroupBy(i => i.ProductionTaskId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<WorkInterval>)g.ToList());
        var now = _timeService.Now;
        var previewIds = await _cdrPreviewService.GetExistingTaskIdsAsync(parentIds, cancellationToken);
        var (priorityMarkViewer, restrictPriorityMark) = GetPriorityMarkScope(targetEmployeeName, viewerIsAdmin);

        var rows = pageResult.Items.Select(parent =>
        {
            childrenByParent.TryGetValue(parent.Id, out var children);
            var (statusText, hasSubtask) = SplitTaskStatusAggregator.Aggregate(
                parent,
                children,
                targetEmployeeName);
            intervalsByTask.TryGetValue(parent.Id, out var intervals);
            intervals ??= Array.Empty<WorkInterval>();
            var dto = TaskTableRowDto.FromParent(
                parent,
                statusText,
                hasSubtask,
                children,
                intervals,
                now,
                childIntervalsByTask,
                priorityMarkViewer,
                restrictPriorityMark);
            dto.HasCdrPreview = previewIds.Contains(parent.Id);
            return dto;
        }).ToList();

        await ApplyCommentBadgeCountsAsync(rows, viewerUserId, cancellationToken);

        return new PaginatedResult<TaskTableRowDto>
        {
            Items = rows,
            TotalCount = pageResult.TotalCount,
            Page = pageResult.Page,
            PageSize = pageResult.PageSize
        };
    }

    public async Task<TaskTableRowDto?> GetRowDtoAsync(
        int id,
        string targetEmployeeName,
        bool viewerIsAdmin = true,
        string? viewerUserId = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken, includeIntervals: true);
        if (task == null)
            return null;

        if (task.HiddenFromTaskTable)
            return null;

        var previewIds = await _cdrPreviewService.GetExistingTaskIdsAsync([id], cancellationToken);
        var hasCdrPreview = previewIds.Contains(id);
        var now = _timeService.Now;
        var intervals = (IReadOnlyList<WorkInterval>)(task.WorkIntervals ?? []);
        var (priorityMarkViewer, restrictPriorityMark) = GetPriorityMarkScope(targetEmployeeName, viewerIsAdmin);

        if (task.ParentRowNumber != null)
        {
            var parent = await _repo.GetTaskByIdAsync(task.ParentRowNumber.Value, cancellationToken);
            var splits = await _repo.GetTaskSplitsByParentIdAsync(task.ParentRowNumber.Value, cancellationToken);
            var sequenceOrder = splits.FirstOrDefault(s => s.ChildTaskId == task.Id)?.SequenceOrder ?? 0;

            var dto = TaskTableRowDto.FromParent(
                task,
                TaskStatusMapper.ApplyPickedUpDisplay(task, TaskStatusMapper.ToText(task.Status)),
                hasCurrentUserSubtask: false,
                workIntervals: intervals,
                now: now,
                priorityMarkViewerEmployeeName: priorityMarkViewer,
                restrictPriorityMarkToViewer: restrictPriorityMark);
            dto.SupplyMode = parent?.SupplyMode ?? SupplyMode.None;
            dto.SequenceOrder = sequenceOrder;
            dto.SequenceStartBlocked = parent?.SupplyMode == SupplyMode.InternalProduction
                && task.Status == JobStatus.Waiting;
            dto.HasCdrPreview = hasCdrPreview;
            await ApplyCommentBadgeCountsAsync([dto], viewerUserId, cancellationToken);
            return dto;
        }

        IReadOnlyList<ProductionTask>? children = null;
        if (task.IsSplitTask)
            children = await _repo.GetChildTasksAsync(task.Id, cancellationToken);

        var (statusText, hasSubtask) = SplitTaskStatusAggregator.Aggregate(
            task,
            children ?? [],
            targetEmployeeName);

        IReadOnlyDictionary<int, IReadOnlyList<WorkInterval>>? childIntervalsByTask = null;
        if (task.IsSplitTask && children is { Count: > 0 })
        {
            var childIds = children.Select(c => c.Id).ToList();
            childIntervalsByTask = (await _repo.GetWorkIntervalsForTaskIdsAsync(childIds, cancellationToken))
                .GroupBy(i => i.ProductionTaskId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<WorkInterval>)g.ToList());
        }

        var parentDto = TaskTableRowDto.FromParent(
            task,
            statusText,
            hasSubtask,
            children,
            intervals,
            now,
            childIntervalsByTask,
            priorityMarkViewer,
            restrictPriorityMark);
        parentDto.HasCdrPreview = hasCdrPreview;
        await ApplyCommentBadgeCountsAsync([parentDto], viewerUserId, cancellationToken);
        return parentDto;
    }

    private async Task ApplyCommentBadgeCountsAsync(
        IReadOnlyList<TaskTableRowDto> rows,
        string? viewerUserId,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0 || string.IsNullOrWhiteSpace(viewerUserId))
            return;

        var counts = await _taskComments.GetUnreadBadgeCountsAsync(
            rows.Select(r => r.Id).ToList(),
            viewerUserId,
            cancellationToken);

        foreach (var row in rows)
        {
            if (counts.TryGetValue(row.Id, out var count))
                row.CommentBadgeCount = count;
        }
    }

    public async Task<TaskTableServiceResult<ProductionTask>> CreateRowAsync(
        CreateTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var parts = request.Parts?
            .Where(p => !string.IsNullOrWhiteSpace(p.EmployeeName) && p.AllocatedHours > 0)
            .ToList() ?? new List<SplitPart>();

        if (parts.Count >= 2)
        {
            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            if (Math.Abs(totalAllocated - request.EstimateHours) > 0.01)
            {
                return TaskTableServiceResult<ProductionTask>.Fail(
                    $"Сумма часов по сотрудникам ({totalAllocated}) должна равняться общему времени ({request.EstimateHours})");
            }

            var combinedTypes = string.Join(", ",
                parts.Select(p => p.TaskType).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct());

            var supplyMode = request.SupplyMode == SupplyMode.InternalProduction
                ? SupplyMode.InternalProduction
                : SupplyMode.Cooperative;

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
                SupplyMode = supplyMode,
                CreatedAt = _timeService.Now,
                UpdatedAt = _timeService.Now
            };

            ProductionTask? parent = null;
            await _repo.ExecuteInTransactionAsync(async ct =>
            {
                await _repo.AddTaskAsync(newTask, ct);
                parent = await _splitService.SplitTaskAsync(
                    newTask.Id,
                    parts,
                    supplyMode,
                    ct);
                await _repo.AppendRootDisplayOrderAsync(parent.Id, ct);
            }, cancellationToken);

            parent = await _repo.GetTaskByIdAsync(newTask.Id, cancellationToken) ?? parent ?? newTask;

            return TaskTableServiceResult<ProductionTask>.Ok(parent);
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

        var throughTest = request.RequiresTestBeforeProduction
            || (singlePart?.RequiresTestBeforeProduction ?? false);
        if (throughTest)
        {
            var testHours = request.RequiresTestBeforeProduction
                ? request.TestEstimateHours
                : singlePart!.TestEstimateHours;
            var productionHours = request.RequiresTestBeforeProduction
                ? request.ProductionEstimateHours
                : singlePart!.ProductionEstimateHours;
            task.RequiresTestBeforeProduction = true;
            task.TestEstimateHours = testHours;
            task.ProductionEstimateHours = productionHours;
            task.EstimateHours = testHours + productionHours;
            task.WorkPhase = TaskWorkPhase.Test;
        }

        await _repo.AddTaskAsync(task, cancellationToken);
        await _repo.AppendRootDisplayOrderAsync(task.Id, cancellationToken);

        await _notificationService.NotifyNewTaskAsync(task);

        return TaskTableServiceResult<ProductionTask>.Ok(task);
    }

    public async Task<TaskTableServiceResult<ProductionTask>> UpdateRowAsync(
        int id,
        UpdateTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        TaskTableServiceResult<ProductionTask>? result = null;
        await _repo.ExecuteWithTaskLifecycleLockAsync(id, async ct =>
        {
            result = await UpdateRowCoreAsync(id, request, ct);
        }, cancellationToken);

        return result ?? TaskTableServiceResult<ProductionTask>.Missing();
    }

    private async Task<TaskTableServiceResult<ProductionTask>> UpdateRowCoreAsync(
        int id,
        UpdateTaskRequest request,
        CancellationToken cancellationToken)
    {
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken, includeIntervals: true);
        if (task == null)
            return TaskTableServiceResult<ProductionTask>.Missing();

        TaskTableConcurrencyHelper.RequireExpectedUpdatedAt(id, task.UpdatedAt, request.ExpectedUpdatedAt);

        var isSplitParent = task.IsSplitTask && task.ParentRowNumber == null;
        if (!isSplitParent
            && request.EmployeeName != null
            && string.IsNullOrWhiteSpace(request.EmployeeName))
        {
            return TaskTableServiceResult<ProductionTask>.Fail(
                "Поле «Сотрудник» не может быть пустым для одиночной задачи.");
        }

        var employeeChanged = !isSplitParent
            && !string.IsNullOrEmpty(request.EmployeeName)
            && !string.Equals(request.EmployeeName, task.EmployeeName, StringComparison.Ordinal);

        if (employeeChanged)
        {
            var isSplitChild = task.ParentRowNumber.HasValue && task.IsSplitTask;
            if (isSplitChild)
            {
                return TaskTableServiceResult<ProductionTask>.Fail(
                    "Сменить сотрудника у части общей задачи можно только через модалку разделения " +
                    "— там корректно пересчитываются часы между сотрудниками.");
            }

            // Завершённая задача: интервалы и «сэкономленные» часы переезжают к новому
            // исполнителю — задача в его стеке готовых, на его таймлайне; у прежнего
            // её больше нет, а в окнах без других работ образуется простой.
            if (task.Status == JobStatus.Completed)
            {
                return await ReattributeCompletedTaskAsync(task, request, cancellationToken);
            }

            // Активная задача с историей: завершаем у старого (его статистика остаётся),
            // создаём новую задачу с пустой историей у нового исполнителя.
            if (HasWorkHistory(task))
            {
                return await ReassignByCloningAsync(task, request, cancellationToken);
            }

            // Без интервалов и без активного статуса — обычное переименование исполнителя
            // в стандартной ветке ниже.
        }

        var oldEmployeeName = task.EmployeeName;
        var newFolderPath = request.FolderPath ?? task.FolderPath;
        var newFileName = request.FileName ?? task.FileName;

        task.CdrPreviewRetryAt = null;
        task.CdrPreviewRetryAttempts = 0;

        task.FolderPath = newFolderPath;
        task.FileName = newFileName;
        task.Comment = request.Comment ?? task.Comment;
        if (request.CommentEditedViaDialog == true)
            task.CommentEditedViaDialog = true;
        task.Deadline = request.Deadline;
        task.EstimateHours = request.EstimateHours;
        task.Type = request.Type ?? task.Type;
        if (request.PriorityMarked.HasValue)
            task.IsPriorityMarked = request.PriorityMarked.Value;
        if (!isSplitParent)
            task.EmployeeName = request.EmployeeName ?? task.EmployeeName;
        else
            task.EmployeeName = "";
        task.ParentRowNumber = request.ParentRowNumber;
        task.UpdatedAt = _timeService.Now;

        if (task.IsSplitTask && task.ParentRowNumber == null)
        {
            var childTasks = await _repo.GetChildTasksAsync(task.Id, cancellationToken);
            foreach (var child in childTasks)
            {
                child.Deadline = request.Deadline;
                child.UpdatedAt = _timeService.Now;
                await _repo.UpdateTaskTableFieldsAsync(child, cancellationToken: cancellationToken);
            }
        }

        string? statusChangedTo = null;
        var completedViaLifecycle = false;
        // Признак перехода в «разблокирующий» статус (Согласовано/В наличии) — после сохранения
        // отдельным личным пушем сообщим исполнителю, что блокировка снята и можно начинать.
        var notifyReadyToStart = false;
        JobStatus? readyToStartStatus = null;
        if (!string.IsNullOrEmpty(request.StatusText))
        {
            var newStatus = TaskStatusMapper.FromText(request.StatusText);
            if (newStatus != task.Status)
            {
                if (newStatus == JobStatus.Approved && task.Status != JobStatus.PendingApproval)
                    return TaskTableServiceResult<ProductionTask>.Fail("Согласовано можно выставить только для задачи «Согласование».");
                if (newStatus == JobStatus.InStock && task.Status != JobStatus.NoItems)
                    return TaskTableServiceResult<ProductionTask>.Fail("«В наличии» можно выставить только для задачи «Нет изделий».");

                if (isSplitParent
                    && newStatus is JobStatus.PendingApproval or JobStatus.NoItems or JobStatus.Approved or JobStatus.InStock)
                {
                    return TaskTableServiceResult<ProductionTask>.Fail(
                        "Инфостатусы выставляются только на дочерних или обычных задачах.");
                }

                if (newStatus == JobStatus.Assigned
                    && task.Status == JobStatus.Waiting
                    && !request.SequenceOverride)
                {
                    return TaskTableServiceResult<ProductionTask>.Fail(
                        "Этап ожидает завершения предыдущего. Используйте обход очереди.");
                }

                if (!SupplyWorkflow.CanTransitionWithOverride(task.Status, newStatus, request.SequenceOverride)
                    && newStatus == JobStatus.Assigned
                    && task.Status != JobStatus.Waiting
                    && request.SequenceOverride)
                {
                    return TaskTableServiceResult<ProductionTask>.Fail("Обход очереди доступен только для статуса «Ожидание».");
                }

                if (newStatus == JobStatus.Completed && task.Status != JobStatus.Completed)
                {
                    if (TaskStatusMapper.IsEmployeeInfoStatus(task.Status))
                    {
                        task.Status = JobStatus.Assigned;
                        await _repo.UpdateTaskAsync(task, cancellationToken);
                    }
                    await _lifecycle.CompleteTaskAsync(task.Id, _timeService.Now, cancellationToken);
                    completedViaLifecycle = true;
                    statusChangedTo = newStatus.ToString();
                }
                else if (TaskStatusMapper.IsEmployeeInfoStatus(newStatus))
                {
                    var now = _timeService.Now;
                    await _repo.CloseOpenIntervalsAsync(task.Id, now, cancellationToken);
                    task.Status = newStatus;
                    statusChangedTo = newStatus.ToString();
                }
                else
                {
                    var resolvedStatus = newStatus;
                    if (newStatus is JobStatus.Approved or JobStatus.InStock
                        && !request.SequenceOverride
                        && await IsBlockedByPreviousSequentialStagesAsync(task, cancellationToken))
                    {
                        resolvedStatus = JobStatus.Waiting;
                    }

                    if (resolvedStatus == JobStatus.Approved
                        && TestPhaseWorkflow.IsAwaitingProductionApproval(task))
                    {
                        task.WorkPhase = TaskWorkPhase.Production;
                        task.Progress = 0;
                        task.ActualHours = 0;
                    }

                    task.Status = resolvedStatus;
                    statusChangedTo = resolvedStatus.ToString();
                    notifyReadyToStart = resolvedStatus is JobStatus.Approved or JobStatus.InStock;
                    readyToStartStatus = notifyReadyToStart ? resolvedStatus : null;
                }
            }
        }

        if (completedViaLifecycle)
        {
            task = await _repo.GetTaskByIdAsync(id, cancellationToken) ?? task;
            ApplyRowMetadata(task, request);
        }

        await _repo.UpdateTaskTableFieldsAsync(
            task,
            includeStatusFields: statusChangedTo != null && !completedViaLifecycle,
            cancellationToken: cancellationToken);
        if (TaskStatusMapper.IsEmployeeInfoStatus(task.Status)
            && task.ParentRowNumber.HasValue
            && task.IsSplitTask)
        {
            await _lifecycle.SyncSplitParentStatusAsync(task.Id, cancellationToken);
        }

        await _notificationService.NotifyTaskUpdatedAsync(task, oldEmployeeName);
        if (statusChangedTo != null)
            await _notificationService.NotifyStatusChangedAsync(task, statusChangedTo);

        if (notifyReadyToStart)
            await _notificationService.NotifyTaskReadyToStartAsync(task, readyToStartStatus!.Value);

        return TaskTableServiceResult<ProductionTask>.Ok(task);
    }

    public async Task<TaskTableServiceResult<List<WorkIntervalEditDto>>> GetIntervalsAsync(
        int taskId,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null)
            return TaskTableServiceResult<List<WorkIntervalEditDto>>.Missing();

        var intervals = (await _repo.GetWorkIntervalsForTaskIdsAsync([taskId], cancellationToken))
            .OrderBy(i => i.StartTime)
            .Select(WorkIntervalEditDto.FromEntity)
            .ToList();

        return TaskTableServiceResult<List<WorkIntervalEditDto>>.Ok(intervals);
    }

    public async Task<TaskTableServiceResult<List<WorkIntervalEditDto>>> UpdateIntervalsAsync(
        int taskId,
        UpdateWorkIntervalsRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, cancellationToken);
        if (task == null)
            return TaskTableServiceResult<List<WorkIntervalEditDto>>.Missing();

        var existing = (await _repo.GetWorkIntervalsForTaskIdsAsync([taskId], cancellationToken)).ToList();
        var byId = existing.ToDictionary(i => i.Id);
        var payload = request.Intervals ?? [];

        if (payload.Count != existing.Count)
            return TaskTableServiceResult<List<WorkIntervalEditDto>>.Fail("Состав интервалов изменён. Обновите окно и повторите.");

        foreach (var row in payload)
        {
            if (!byId.ContainsKey(row.Id))
                return TaskTableServiceResult<List<WorkIntervalEditDto>>.Fail("Некорректный интервал в запросе.");
            if (row.EndTime.HasValue && row.EndTime.Value <= row.StartTime)
                return TaskTableServiceResult<List<WorkIntervalEditDto>>.Fail("Время окончания должно быть позже времени начала.");
        }

        var ordered = payload.OrderBy(i => i.StartTime).ToList();
        for (var i = 1; i < ordered.Count; i++)
        {
            var prevEnd = ordered[i - 1].EndTime;
            if (prevEnd.HasValue && ordered[i].StartTime < prevEnd.Value)
                return TaskTableServiceResult<List<WorkIntervalEditDto>>.Fail("Интервалы не должны пересекаться.");
        }

        if (ordered.Count > 0)
        {
            for (var i = 0; i < ordered.Count - 1; i++)
            {
                if (!ordered[i].EndTime.HasValue)
                    return TaskTableServiceResult<List<WorkIntervalEditDto>>.Fail("Открытый интервал может быть только последним.");
            }
        }

        foreach (var row in payload)
        {
            var interval = byId[row.Id];
            interval.StartTime = NormalizeIntervalWallClock(row.StartTime);
            interval.EndTime = row.EndTime.HasValue
                ? NormalizeIntervalWallClock(row.EndTime.Value)
                : null;
            _repo.StageWorkIntervalForUpdate(interval);
        }

        // Закрытие последнего открытого интервала у «Начал» → «Пауза»
        // (иначе статус и интервалы расходятся: in_progress_without_open_interval).
        var pausedDueToClosedInterval = false;
        var hasOpenAfterSave = byId.Values.Any(i => i.EndTime == null);
        if (task.Status == JobStatus.InProgress && !hasOpenAfterSave)
        {
            task.Status = JobStatus.Paused;
            pausedDueToClosedInterval = true;
        }

        if (task.Status == JobStatus.Completed)
        {
            var now = _timeService.Now;
            var workHoursBetween = (DateTime start, DateTime end) => _workHours.GetWorkHoursBetween(
                AppDateTime.ToMoscowWallClockFromDb(start),
                AppDateTime.ToMoscowWallClockFromDb(end));
            var oldSaved = TestPhaseWorkflow.ComputeSavedHours(task, existing, workHoursBetween);
            var updatedIntervals = byId.Values.ToList();
            var newActualHours = CalculateActualHours(new ProductionTask
            {
                ActualHours = task.ActualHours,
                EmployeeName = task.EmployeeName,
                WorkIntervals = updatedIntervals
            });
            var newSaved = TestPhaseWorkflow.ComputeSavedHours(
                task,
                updatedIntervals,
                workHoursBetween);

            await TransferSavedHoursAsync(
                task.EmployeeName,
                task.EmployeeName,
                oldSaved,
                newSaved,
                task.CompletedAt,
                now,
                cancellationToken);

            task.ActualHours = newActualHours;
            task.UpdatedAt = now;
            await _repo.UpdateTaskAsync(task, cancellationToken);
        }
        else
        {
            task.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(task, cancellationToken);
        }

        if (pausedDueToClosedInterval)
        {
            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await _lifecycle.SyncSplitParentStatusAsync(task.Id, cancellationToken);
            await _notificationService.NotifyStatusChangedAsync(task, "Paused");
        }

        var updated = (await _repo.GetWorkIntervalsForTaskIdsAsync([taskId], cancellationToken))
            .OrderBy(i => i.StartTime)
            .Select(WorkIntervalEditDto.FromEntity)
            .ToList();
        return TaskTableServiceResult<List<WorkIntervalEditDto>>.Ok(updated);
    }

    /// <summary>
    /// Удаление с сохранением статистики: если у задачи (или у любой её дочерней) есть
    /// история работы — интервалы закрываются, статус становится Completed, и запись
    /// остаётся в стеке выполненных. Без истории — физическое удаление как раньше.
    /// </summary>
    public async Task<TaskTableServiceResult<bool>> DeleteRowAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        TaskTableServiceResult<bool>? result = null;
        await _repo.ExecuteWithTaskLifecycleLockAsync(id, async ct =>
        {
            result = await DeleteRowCoreAsync(id, ct);
        }, cancellationToken);

        return result ?? TaskTableServiceResult<bool>.Missing();
    }

    private async Task<TaskTableServiceResult<bool>> DeleteRowCoreAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken, includeIntervals: true);
        if (task == null)
            return TaskTableServiceResult<bool>.Missing();

        var employeeNames = new HashSet<string>(StringComparer.Ordinal);
        if (!string.IsNullOrEmpty(task.EmployeeName))
            employeeNames.Add(task.EmployeeName);

        var isSplitParent = task.IsSplitTask && task.ParentRowNumber == null;
        if (isSplitParent)
        {
            return await DeleteSplitParentAsync(task, employeeNames, cancellationToken);
        }

        if (ShouldKeepInCompletedStackOnDelete(task))
        {
            var parentId = task.ParentRowNumber;
            await CompleteForTableRemovalAsync(task, cancellationToken);

            if (parentId.HasValue && task.IsSplitTask)
            {
                await _repo.DetachTasksFromSplitAsync([task.Id], cancellationToken);
                await RefreshParentAfterChildRemovalAsync(parentId.Value, cancellationToken);
            }

            await _notificationService.NotifyTaskDeletedAsync(id, employeeNames);
            return TaskTableServiceResult<bool>.Ok(true);
        }

        var deletedChildParentId = task.ParentRowNumber;
        await _repo.DeleteTaskAsync(id, cancellationToken);
        if (deletedChildParentId.HasValue && task.IsSplitTask)
            await RefreshParentAfterChildRemovalAsync(deletedChildParentId.Value, cancellationToken);
        await _notificationService.NotifyTaskDeletedAsync(id, employeeNames);
        return TaskTableServiceResult<bool>.Ok(true);
    }

    private async Task<TaskTableServiceResult<bool>> DeleteSplitParentAsync(
        ProductionTask parent,
        HashSet<string> employeeNames,
        CancellationToken cancellationToken)
    {
        var children = await _repo.GetChildTasksAsync(parent.Id, cancellationToken);
        foreach (var child in children)
        {
            if (!string.IsNullOrEmpty(child.EmployeeName))
                employeeNames.Add(child.EmployeeName);
        }

        var childrenWithHistory = new List<ProductionTask>();
        var childrenWithoutHistory = new List<ProductionTask>();
        foreach (var child in children)
        {
            var full = await _repo.GetTaskByIdAsync(child.Id, cancellationToken, includeIntervals: true);
            if (full == null) continue;
            (ShouldKeepInCompletedStackOnDelete(full) ? childrenWithHistory : childrenWithoutHistory).Add(full);
        }

        if (childrenWithHistory.Count == 0)
        {
            // Никто из исполнителей не работал — можно физически снести всё дерево.
            await _repo.DeleteTaskAsync(parent.Id, cancellationToken);
            await _notificationService.NotifyTaskDeletedAsync(parent.Id, employeeNames);
            return TaskTableServiceResult<bool>.Ok(true);
        }

        // Дети без работы можно удалить — их история не нужна для статистики.
        foreach (var child in childrenWithoutHistory)
        {
            await _repo.DeleteTaskAsync(child.Id, cancellationToken);
        }

        // Дети с историей уходят в стек выполненных, но отсоединяются от сплита,
        // чтобы удалённая дочерняя строка больше не возвращалась в таблицу.
        foreach (var child in childrenWithHistory)
        {
            await CompleteForTableRemovalAsync(child, cancellationToken);
        }

        await _repo.DetachTasksFromSplitAsync(childrenWithHistory.Select(c => c.Id).ToList(), cancellationToken);
        await _repo.DeleteTaskAsync(parent.Id, cancellationToken);
        await _notificationService.NotifyTaskDeletedAsync(parent.Id, employeeNames);

        return TaskTableServiceResult<bool>.Ok(true);
    }

    private async Task CompleteForTableRemovalAsync(
        ProductionTask task,
        CancellationToken cancellationToken)
    {
        var now = _timeService.Now;
        await _repo.CloseOpenIntervalsAsync(task.Id, now, cancellationToken);
        await _repo.HideTaskFromTableAsync(task.Id, cancellationToken);

        if (task.Status == JobStatus.Completed)
            return;

        var full = await _repo.GetTaskByIdAsync(task.Id, cancellationToken, includeIntervals: true) ?? task;
        var actualHours = CalculateActualHours(full);

        await _repo.TryTransitionStatusAsync(
            task.Id,
            JobStatus.Completed,
            now,
            expectedStatuses: null,
            new TaskStatusPatch
            {
                Progress = 1,
                CompletedAt = now,
                ActualHours = actualHours
            },
            cancellationToken);

        if (!string.IsNullOrEmpty(full.EmployeeName))
            await _statsService.AddSavedHoursAsync(full.EmployeeName, full.EstimateHours - actualHours, now);

        var completed = await _repo.GetTaskByIdAsync(task.Id, cancellationToken);
        if (completed != null)
            await _notificationService.NotifyStatusChangedAsync(completed, "Completed");
    }

    private double CalculateActualHours(ProductionTask task)
    {
        if (task.WorkIntervals.Count == 0)
            return task.ActualHours;

        return task.WorkIntervals
            .Where(interval => interval.EndTime.HasValue)
            .Sum(interval => _workHours.GetWorkHoursBetween(
                AppDateTime.ToMoscowWallClockFromDb(interval.StartTime),
                AppDateTime.ToMoscowWallClockFromDb(interval.EndTime!.Value)));
    }

    private async Task<bool> IsBlockedByPreviousSequentialStagesAsync(
        ProductionTask task,
        CancellationToken cancellationToken)
    {
        if (!task.ParentRowNumber.HasValue || !task.IsSplitTask)
            return false;

        var parent = await _repo.GetTaskByIdAsync(task.ParentRowNumber.Value, cancellationToken);
        if (parent == null || !SupplyWorkflow.IsSequential(parent.SupplyMode))
            return false;

        var splits = await _repo.GetTaskSplitsByParentIdAsync(parent.Id, cancellationToken);
        var currentSplit = splits.FirstOrDefault(s => s.ChildTaskId == task.Id);
        if (currentSplit == null)
            return false;

        var previousChildIds = splits
            .Where(s => s.SequenceOrder < currentSplit.SequenceOrder)
            .Select(s => s.ChildTaskId)
            .ToHashSet();
        if (previousChildIds.Count == 0)
            return false;

        var children = await _repo.GetChildTasksAsync(parent.Id, cancellationToken);
        return children.Any(c => previousChildIds.Contains(c.Id) && c.Status != JobStatus.Completed);
    }

    private async Task RefreshParentAfterChildRemovalAsync(
        int parentId,
        CancellationToken cancellationToken)
    {
        await _splitService.AdvanceSequentialStageAsync(parentId, cancellationToken);

        var parent = await _repo.GetTaskByIdAsync(parentId, cancellationToken);
        if (parent == null || !parent.IsSplitTask)
            return;

        var children = await _repo.GetChildTasksAsync(parentId, cancellationToken);
        if (children.Count == 0)
        {
            await _repo.DeleteTaskAsync(parentId, cancellationToken);
            await _notificationService.NotifyTaskDeletedAsync(parentId, []);
            return;
        }

        var newStatus = SplitTaskStatusAggregator.ResolveParentStatus(children);
        var now = _timeService.Now;
        var patch = SplitTaskStatusAggregator.BuildParentStatusPatch(newStatus, children, now);

        await _repo.TryTransitionStatusAsync(
            parentId,
            newStatus,
            now,
            expectedStatuses: null,
            patch,
            cancellationToken);

        parent = await _repo.GetTaskByIdAsync(parentId, cancellationToken);
        if (parent != null)
            await _notificationService.NotifyTaskUpdatedAsync(parent);
    }

    /// <summary>
    /// Смена сотрудника у уже выполненной задачи: запись остаётся та же, интервалы остаются
    /// привязанными к ней, но <see cref="ProductionTask.EmployeeName"/> переписывается на нового
    /// исполнителя. В результате задача исчезает из стека готовых и таймлайна прежнего сотрудника
    /// (там, где она не перекрывала других интервалов, окно отрисуется как простой), а у нового —
    /// появляется в истории. Параллельно переносим «сэкономленные» часы между EmployeeStats.
    /// </summary>
    private async Task<TaskTableServiceResult<ProductionTask>> ReattributeCompletedTaskAsync(
        ProductionTask original,
        UpdateTaskRequest request,
        CancellationToken cancellationToken)
    {
        var oldEmployeeName = original.EmployeeName;
        var newEmployeeName = request.EmployeeName!;
        var now = _timeService.Now;

        var oldSaved = original.EstimateHours - original.ActualHours;
        var newSaved = request.EstimateHours - original.ActualHours;

        await TransferSavedHoursAsync(
            oldEmployeeName,
            newEmployeeName,
            oldSaved,
            newSaved,
            original.CompletedAt,
            now,
            cancellationToken);

        original.FolderPath = request.FolderPath ?? original.FolderPath;
        original.FileName = request.FileName ?? original.FileName;
        original.Comment = request.Comment ?? original.Comment;
        original.Deadline = request.Deadline;
        original.EstimateHours = request.EstimateHours;
        original.Type = request.Type ?? original.Type;
        if (request.PriorityMarked.HasValue)
            original.IsPriorityMarked = request.PriorityMarked.Value;
        original.EmployeeName = newEmployeeName;
        original.UpdatedAt = now;

        await _repo.UpdateTaskAsync(original, cancellationToken);

        // Уведомим прежнего исполнителя (задача исчезла) и нового (появилась).
        await _notificationService.NotifyTaskUpdatedAsync(original, oldEmployeeName);

        return TaskTableServiceResult<ProductionTask>.Ok(original);
    }

    /// <summary>
    /// Переносит «сэкономленные» часы между двумя <see cref="EmployeeStat"/>:
    /// у прежнего сотрудника списывает <paramref name="oldSaved"/>, новому начисляет
    /// <paramref name="newSaved"/>. <c>TodaySavedHours</c> трогаем, только если задача
    /// была завершена сегодня — иначе сегодняшние итоги исказятся.
    /// </summary>
    private async Task TransferSavedHoursAsync(
        string fromEmployee,
        string toEmployee,
        double oldSaved,
        double newSaved,
        DateTime? completedAt,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var completedToday = completedAt.HasValue
            && AppDateTime.ToMoscowWallClockFromDb(completedAt.Value).Date == now.Date;

        if (!string.IsNullOrEmpty(fromEmployee))
        {
            var fromStat = await _repo.GetEmployeeStatAsync(fromEmployee, cancellationToken);
            if (fromStat != null)
            {
                fromStat.TotalSavedHours = Math.Max(0, fromStat.TotalSavedHours - oldSaved);
                if (completedToday && fromStat.LastResetDate.Date == now.Date)
                    fromStat.TodaySavedHours = Math.Max(0, fromStat.TodaySavedHours - oldSaved);
                await _repo.UpdateEmployeeStatAsync(fromStat, cancellationToken);
            }
        }

        if (!string.IsNullOrEmpty(toEmployee))
        {
            var toStat = await _repo.GetEmployeeStatAsync(toEmployee, cancellationToken)
                ?? new EmployeeStat
                {
                    EmployeeName = toEmployee,
                    LastResetDate = now.Date
                };

            // Если новый сотрудник не «открывал» сегодняшний день — открываем мы.
            if (toStat.LastResetDate.Date != now.Date)
            {
                toStat.TodaySavedHours = 0;
                toStat.LastResetDate = now.Date;
            }

            toStat.TotalSavedHours += newSaved;
            if (completedToday)
                toStat.TodaySavedHours += newSaved;

            await _repo.UpdateEmployeeStatAsync(toStat, cancellationToken);
        }
    }

    /// <summary>
    /// Смена сотрудника у задачи с историей работы: исходную задачу аккуратно завершаем
    /// (закрываем интервалы, считаем ActualHours, обновляем EmployeeStats прежнего сотрудника),
    /// и создаём новую задачу под нового исполнителя с заданными параметрами и пустой историей.
    /// </summary>
    private async Task<TaskTableServiceResult<ProductionTask>> ReassignByCloningAsync(
        ProductionTask original,
        UpdateTaskRequest request,
        CancellationToken cancellationToken)
    {
        var oldEmployeeName = original.EmployeeName;
        var now = _timeService.Now;

        if (original.Status != JobStatus.Completed)
            await _lifecycle.CompleteTaskAsync(original.Id, now, cancellationToken);

        var clone = new ProductionTask
        {
            DisplayOrder = -1,
            FolderPath = request.FolderPath ?? original.FolderPath,
            FileName = request.FileName ?? original.FileName,
            Comment = request.Comment ?? original.Comment,
            CommentEditedViaDialog = original.CommentEditedViaDialog
                || request.CommentEditedViaDialog == true,
            Deadline = request.Deadline,
            EstimateHours = request.EstimateHours,
            Type = request.Type ?? original.Type,
            IsPriorityMarked = request.PriorityMarked ?? original.IsPriorityMarked,
            EmployeeName = request.EmployeeName!,
            Status = JobStatus.Assigned,
            Progress = 0,
            ActualHours = 0,
            ParentRowNumber = null,
            IsSplitTask = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _repo.AddTaskAsync(clone, cancellationToken);
        await _repo.AppendRootDisplayOrderAsync(clone.Id, cancellationToken);

        await _notificationService.NotifyNewTaskAsync(clone);

        // Старая запись поменяла исполнителя на «исторического» (бывшего); уведомим обе стороны.
        var finalOriginal = await _repo.GetTaskByIdAsync(original.Id, cancellationToken) ?? original;
        await _notificationService.NotifyTaskUpdatedAsync(finalOriginal, oldEmployeeName);

        return TaskTableServiceResult<ProductionTask>.Reassigned(clone, original.Id);
    }

    public Task ReorderRowsAsync(List<int> orderedIds, CancellationToken cancellationToken = default) =>
        _repo.ReorderTasksAsync(orderedIds, cancellationToken);

    /// <summary>Московская стенка из API (как AppTimeService), без сдвига UTC.</summary>
    private static DateTime NormalizeIntervalWallClock(DateTime value) =>
        value.Kind == DateTimeKind.Utc
            ? AppDateTime.ToMoscowWallClockFromDb(value)
            : DateTime.SpecifyKind(value, DateTimeKind.Unspecified);

    private static void ApplyRowMetadata(ProductionTask task, UpdateTaskRequest request)
    {
        var isSplitParent = task.IsSplitTask && task.ParentRowNumber == null;

        task.FolderPath = request.FolderPath ?? task.FolderPath;
        task.FileName = request.FileName ?? task.FileName;
        task.Comment = request.Comment ?? task.Comment;
        if (request.CommentEditedViaDialog == true)
            task.CommentEditedViaDialog = true;
        task.Deadline = request.Deadline;
        task.EstimateHours = request.EstimateHours;
        task.Type = request.Type ?? task.Type;
        if (request.PriorityMarked.HasValue)
            task.IsPriorityMarked = request.PriorityMarked.Value;
        if (!isSplitParent)
            task.EmployeeName = request.EmployeeName ?? task.EmployeeName;
        else
            task.EmployeeName = "";
        task.ParentRowNumber = request.ParentRowNumber;
    }
}
