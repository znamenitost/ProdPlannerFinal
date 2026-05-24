using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.TaskTable;

public class TaskTableService : ITaskTableService
{
    private readonly IProductionTaskRepository _repo;
    private readonly ITaskLifecycleService _lifecycle;
    private readonly IAppTimeService _timeService;
    private readonly ITaskNotificationService _notificationService;
    private readonly ITaskSplitService _splitService;

    public TaskTableService(
        IProductionTaskRepository repo,
        ITaskLifecycleService lifecycle,
        IAppTimeService timeService,
        ITaskNotificationService notificationService,
        ITaskSplitService splitService)
    {
        _repo = repo;
        _lifecycle = lifecycle;
        _timeService = timeService;
        _notificationService = notificationService;
        _splitService = splitService;
    }

    /// <summary>
    /// Признак, что у задачи есть «история работы» — закрытые/открытые интервалы или активный статус.
    /// Используется при удалении и смене сотрудника, чтобы решить, можно ли физически удалить запись
    /// или нужно сохранить её как Completed для статистики.
    /// </summary>
    private static bool HasWorkHistory(ProductionTask task) =>
        (task.WorkIntervals?.Count ?? 0) > 0
        || task.Status is JobStatus.InProgress or JobStatus.Paused;

    public async Task<PaginatedResult<TaskTableRowDto>> GetRowsAsync(
        int page,
        int pageSize,
        string targetEmployeeName,
        CancellationToken cancellationToken = default)
    {
        var pageResult = await _repo.GetRootTasksPaginatedAsync(page, pageSize, cancellationToken);

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
        var now = _timeService.Now;

        var rows = pageResult.Items.Select(parent =>
        {
            childrenByParent.TryGetValue(parent.Id, out var children);
            var (statusText, hasSubtask) = SplitTaskStatusAggregator.Aggregate(
                parent,
                children,
                targetEmployeeName);
            intervalsByTask.TryGetValue(parent.Id, out var intervals);
            intervals ??= Array.Empty<WorkInterval>();
            return TaskTableRowDto.FromParent(
                parent, statusText, hasSubtask, children, intervals, now);
        }).ToList();

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
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken, includeIntervals: true);
        if (task == null)
            return null;

        var now = _timeService.Now;
        var intervals = (IReadOnlyList<WorkInterval>)(task.WorkIntervals ?? []);

        if (task.ParentRowNumber != null)
        {
            return TaskTableRowDto.FromParent(
                task,
                TaskStatusMapper.ToText(task.Status),
                hasCurrentUserSubtask: false,
                workIntervals: intervals,
                now: now);
        }

        IReadOnlyList<ProductionTask>? children = null;
        if (task.IsSplitTask)
            children = await _repo.GetChildTasksAsync(task.Id, cancellationToken);

        var (statusText, hasSubtask) = SplitTaskStatusAggregator.Aggregate(
            task,
            children ?? [],
            targetEmployeeName);

        return TaskTableRowDto.FromParent(
            task, statusText, hasSubtask, children, intervals, now);
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

            ProductionTask? parent = null;
            await _repo.ExecuteInTransactionAsync(async ct =>
            {
                await _repo.AddTaskAsync(newTask, ct);
                parent = await _splitService.SplitTaskAsync(newTask.Id, parts, ct);
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
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken, includeIntervals: true);
        if (task == null)
            return TaskTableServiceResult<ProductionTask>.Missing();

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

        task.FolderPath = request.FolderPath ?? task.FolderPath;
        task.FileName = request.FileName ?? task.FileName;
        task.Comment = request.Comment ?? task.Comment;
        task.Deadline = request.Deadline;
        task.EstimateHours = request.EstimateHours;
        task.Type = request.Type ?? task.Type;
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
                await _repo.UpdateTaskAsync(child, cancellationToken);
            }
        }

        string? statusChangedTo = null;
        var completedViaLifecycle = false;
        if (!string.IsNullOrEmpty(request.StatusText))
        {
            var newStatus = TaskStatusMapper.FromText(request.StatusText);
            if (newStatus != task.Status)
            {
                if (newStatus == JobStatus.Approved && task.Status != JobStatus.PendingApproval)
                    return TaskTableServiceResult<ProductionTask>.Fail("Согласовано можно выставить только для задачи «Согласование».");
                if (newStatus == JobStatus.InStock && task.Status != JobStatus.NoItems)
                    return TaskTableServiceResult<ProductionTask>.Fail("«В наличии» можно выставить только для задачи «Нет изделий».");

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
                    task.Status = newStatus;
                    statusChangedTo = newStatus.ToString();
                }
            }
        }

        if (completedViaLifecycle)
        {
            task = await _repo.GetTaskByIdAsync(id, cancellationToken) ?? task;
            ApplyRowMetadata(task, request);
        }

        await _repo.UpdateTaskAsync(task, cancellationToken);
        if (TaskStatusMapper.IsEmployeeInfoStatus(task.Status)
            && task.ParentRowNumber.HasValue
            && task.IsSplitTask)
        {
            await _lifecycle.SyncSplitParentStatusAsync(task.Id, cancellationToken);
        }

        await _notificationService.NotifyTaskUpdatedAsync(task, oldEmployeeName);
        if (statusChangedTo != null)
            await _notificationService.NotifyStatusChangedAsync(task, statusChangedTo);

        return TaskTableServiceResult<ProductionTask>.Ok(task);
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

        if (HasWorkHistory(task))
        {
            if (task.Status != JobStatus.Completed)
                await _lifecycle.CompleteTaskAsync(task.Id, _timeService.Now, cancellationToken);

            // CompleteTaskAsync уже отправил TaskStatusChanged; отдельное TaskDeleted не шлём,
            // потому что задача всё ещё существует — просто переехала в выполненные.
            return TaskTableServiceResult<bool>.Ok(true);
        }

        await _repo.DeleteTaskAsync(id, cancellationToken);
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
            (HasWorkHistory(full) ? childrenWithHistory : childrenWithoutHistory).Add(full);
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

        // Дети с работой переводим в Completed (там корректно посчитаются ActualHours
        // и саженные часы попадут в EmployeeStats каждому сотруднику).
        foreach (var child in childrenWithHistory.Where(c => c.Status != JobStatus.Completed))
        {
            await _lifecycle.CompleteTaskAsync(child.Id, _timeService.Now, cancellationToken);
        }

        // Родитель должен оказаться Completed (последний CompleteTaskAsync вызывает UpdateParentStatusAsync).
        var finalParent = await _repo.GetTaskByIdAsync(parent.Id, cancellationToken);
        if (finalParent != null && finalParent.Status != JobStatus.Completed)
        {
            await _lifecycle.CompleteTaskAsync(parent.Id, _timeService.Now, cancellationToken);
        }

        return TaskTableServiceResult<bool>.Ok(true);
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
            Deadline = request.Deadline,
            EstimateHours = request.EstimateHours,
            Type = request.Type ?? original.Type,
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

        return TaskTableServiceResult<ProductionTask>.Ok(clone);
    }

    public Task ReorderRowsAsync(List<int> orderedIds, CancellationToken cancellationToken = default) =>
        _repo.ReorderTasksAsync(orderedIds, cancellationToken);

    private static void ApplyRowMetadata(ProductionTask task, UpdateTaskRequest request)
    {
        var isSplitParent = task.IsSplitTask && task.ParentRowNumber == null;

        task.FolderPath = request.FolderPath ?? task.FolderPath;
        task.FileName = request.FileName ?? task.FileName;
        task.Comment = request.Comment ?? task.Comment;
        task.Deadline = request.Deadline;
        task.EstimateHours = request.EstimateHours;
        task.Type = request.Type ?? task.Type;
        if (!isSplitParent)
            task.EmployeeName = request.EmployeeName ?? task.EmployeeName;
        else
            task.EmployeeName = "";
        task.ParentRowNumber = request.ParentRowNumber;
    }
}
