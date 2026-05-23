using ProductionPlanner.Data;
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

            await _repo.AddTaskAsync(newTask, cancellationToken);
            var parent = await _splitService.SplitTaskAsync(newTask.Id, parts, cancellationToken);
            await _repo.AppendRootDisplayOrderAsync(parent.Id, cancellationToken);

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
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken);
        if (task == null)
            return TaskTableServiceResult<ProductionTask>.Missing();

        var oldEmployeeName = task.EmployeeName;

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
                }

                if (statusChangedTo == null)
                    statusChangedTo = newStatus.ToString();
            }
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

    public async Task<TaskTableServiceResult<bool>> DeleteRowAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskByIdAsync(id, cancellationToken);
        if (task == null)
            return TaskTableServiceResult<bool>.Missing();

        var employeeNames = new HashSet<string>();
        if (!string.IsNullOrEmpty(task.EmployeeName))
            employeeNames.Add(task.EmployeeName);

        if (task.IsSplitTask)
        {
            var children = await _repo.GetChildTasksAsync(task.Id, cancellationToken);
            foreach (var child in children)
            {
                if (!string.IsNullOrEmpty(child.EmployeeName))
                    employeeNames.Add(child.EmployeeName);
            }
        }

        await _repo.DeleteTaskAsync(id, cancellationToken);
        await _notificationService.NotifyTaskDeletedAsync(id, employeeNames);

        return TaskTableServiceResult<bool>.Ok(true);
    }

    public Task ReorderRowsAsync(List<int> orderedIds, CancellationToken cancellationToken = default) =>
        _repo.ReorderTasksAsync(orderedIds, cancellationToken);
}
