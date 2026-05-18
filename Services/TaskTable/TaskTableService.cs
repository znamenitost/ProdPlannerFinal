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
        string targetEmployeeName)
    {
        var pageResult = await _repo.GetRootTasksPaginatedAsync(page, pageSize);

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
        var childrenByParent = await _repo.GetSplitChildrenByParentIdsAsync(parentIds);

        var rows = pageResult.Items.Select(parent =>
        {
            childrenByParent.TryGetValue(parent.Id, out var children);
            var (statusText, hasSubtask) = SplitTaskStatusAggregator.Aggregate(
                parent,
                children,
                targetEmployeeName);
            return TaskTableRowDto.FromParent(parent, statusText, hasSubtask, children);
        }).ToList();

        return new PaginatedResult<TaskTableRowDto>
        {
            Items = rows,
            TotalCount = pageResult.TotalCount,
            Page = pageResult.Page,
            PageSize = pageResult.PageSize
        };
    }

    public async Task<TaskTableServiceResult<ProductionTask>> CreateRowAsync(CreateTaskRequest request)
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

            await _repo.AddTaskAsync(newTask);
            await _splitService.SplitTaskAsync(newTask.Id, parts);

            return TaskTableServiceResult<ProductionTask>.Ok(newTask);
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

        await _repo.AddTaskAsync(task);

        var allRootIds = (await _repo.GetRootTasksAsync()).OrderBy(t => t.DisplayOrder).Select(t => t.Id).ToList();
        await _repo.ReorderTasksAsync(allRootIds);

        await _notificationService.NotifyNewTaskAsync(task);

        return TaskTableServiceResult<ProductionTask>.Ok(task);
    }

    public async Task<TaskTableServiceResult<ProductionTask>> UpdateRowAsync(int id, UpdateTaskRequest request)
    {
        var task = await _repo.GetTaskByIdAsync(id);
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
            var childTasks = await _repo.GetChildTasksAsync(task.Id);
            foreach (var child in childTasks)
            {
                child.Deadline = request.Deadline;
                child.UpdatedAt = _timeService.Now;
                await _repo.UpdateTaskAsync(child);
            }
        }

        if (!string.IsNullOrEmpty(request.StatusText))
        {
            var newStatus = TaskStatusMapper.FromText(request.StatusText);
            if (newStatus != task.Status)
            {
                if (newStatus == JobStatus.Completed && task.Status != JobStatus.Completed)
                    await _lifecycle.CompleteTaskAsync(task.Id, _timeService.Now);
                else
                    task.Status = newStatus;
            }
        }

        await _repo.UpdateTaskAsync(task);
        await _notificationService.NotifyTaskUpdatedAsync(task, oldEmployeeName);

        return TaskTableServiceResult<ProductionTask>.Ok(task);
    }

    public async Task<TaskTableServiceResult<bool>> DeleteRowAsync(int id)
    {
        var task = await _repo.GetTaskByIdAsync(id);
        if (task == null)
            return TaskTableServiceResult<bool>.Missing();

        var employeeNames = new HashSet<string>();
        if (!string.IsNullOrEmpty(task.EmployeeName))
            employeeNames.Add(task.EmployeeName);

        if (task.IsSplitTask)
        {
            var children = await _repo.GetChildTasksAsync(task.Id);
            foreach (var child in children)
            {
                if (!string.IsNullOrEmpty(child.EmployeeName))
                    employeeNames.Add(child.EmployeeName);
            }
        }

        await _repo.DeleteTaskAsync(id);
        await _notificationService.NotifyTaskDeletedAsync(id, employeeNames);

        return TaskTableServiceResult<bool>.Ok(true);
    }

    public Task ReorderRowsAsync(List<int> orderedIds) => _repo.ReorderTasksAsync(orderedIds);
}
