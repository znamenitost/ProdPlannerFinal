using ProductionPlanner.Data;
using ProductionPlanner.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ProductionPlanner.Services
{
    public class TaskSplitService : ITaskSplitService
    {
        private readonly IProductionTaskRepository _repo;
        private readonly ApplicationDbContext _context;
        private readonly IAppTimeService _timeService;
        private readonly ITaskNotificationService _notificationService;
        private readonly IServiceProvider _serviceProvider;

        public TaskSplitService(
            IProductionTaskRepository repo,
            ApplicationDbContext context,
            IAppTimeService timeService,
            ITaskNotificationService notificationService,
            IServiceProvider serviceProvider)
        {
            _repo = repo;
            _context = context;
            _timeService = timeService;
            _notificationService = notificationService;
            _serviceProvider = serviceProvider;
        }

        public async Task<ProductionTask> SplitTaskAsync(int parentTaskId, List<SplitPart> parts)
        {
            var parentTask = await _repo.GetTaskByIdAsync(parentTaskId);
            if (parentTask == null)
                throw new Exception($"Задача {parentTaskId} не найдена");

            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            parentTask.EstimateHours = totalAllocated;
            parentTask.Type = string.Join(", ",
                parts.Select(p => p.TaskType).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct());

            foreach (var part in parts)
            {
                var childTask = CreateChildFromPart(parentTask, part);
                await _repo.AddTaskAsync(childTask);

                var split = new TaskSplit
                {
                    ParentRowNumber = parentTask.Id,
                    ChildTaskId = childTask.Id,
                    AssignedTo = part.EmployeeName,
                    SplitType = part.TaskType,
                    AllocatedHours = part.AllocatedHours
                };
                await _context.TaskSplits.AddAsync(split);

                await _notificationService.NotifyNewTaskAsync(childTask);
            }

            parentTask.IsSplitTask = true;
            parentTask.EmployeeName = "";
            parentTask.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(parentTask);

            await _context.SaveChangesAsync();

            var allRootIds = (await _repo.GetRootTasksAsync()).OrderBy(t => t.DisplayOrder).Select(t => t.Id).ToList();
            await _repo.ReorderTasksAsync(allRootIds);

            return parentTask;
        }

        public async Task<ProductionTask> UpdateSplitAsync(int parentTaskId, List<SplitPart> parts)
        {
            var parentTask = await _repo.GetTaskByIdAsync(parentTaskId);
            if (parentTask == null)
                throw new Exception($"Задача {parentTaskId} не найдена");
            if (parentTask.ParentRowNumber != null)
                throw new Exception("Нельзя редактировать назначения у подзадачи");

            if (parts.Count == 0)
                throw new Exception("Укажите сотрудника");

            if (parts.Count == 1)
                return await ConvertToRegularTaskAsync(parentTask, parts[0]);

            if (!parentTask.IsSplitTask)
                return await SplitTaskAsync(parentTaskId, parts);

            var existingChildren = await GetChildTasksAsync(parentTaskId);
            var splits = await _context.TaskSplits.Where(ts => ts.ParentRowNumber == parentTaskId).ToListAsync();
            var usedChildIds = new HashSet<int>();
            var now = _timeService.Now;

            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            parentTask.EstimateHours = totalAllocated;
            parentTask.Type = string.Join(", ",
                parts.Select(p => p.TaskType).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct());
            parentTask.EmployeeName = "";
            parentTask.UpdatedAt = now;

            foreach (var part in parts)
            {
                var child = ResolveChildForPart(part, existingChildren, usedChildIds);

                if (child != null)
                {
                    usedChildIds.Add(child.Id);
                    ApplyPartToChild(child, parentTask, part);
                    await _repo.UpdateTaskAsync(child);

                    var splitRecord = splits.FirstOrDefault(s => s.ChildTaskId == child.Id);
                    if (splitRecord != null)
                    {
                        splitRecord.AssignedTo = part.EmployeeName;
                        splitRecord.SplitType = part.TaskType;
                        splitRecord.AllocatedHours = part.AllocatedHours;
                    }
                }
                else
                {
                    var newChild = CreateChildFromPart(parentTask, part);
                    await _repo.AddTaskAsync(newChild);
                    usedChildIds.Add(newChild.Id);

                    await _context.TaskSplits.AddAsync(new TaskSplit
                    {
                        ParentRowNumber = parentTask.Id,
                        ChildTaskId = newChild.Id,
                        AssignedTo = part.EmployeeName,
                        SplitType = part.TaskType,
                        AllocatedHours = part.AllocatedHours
                    });

                    await _notificationService.NotifyNewTaskAsync(newChild);
                }
            }

            var lifecycle = _serviceProvider.GetRequiredService<ITaskLifecycleService>();

            foreach (var orphan in existingChildren.Where(c => !usedChildIds.Contains(c.Id)))
            {
                if (CanRemoveChild(orphan))
                {
                    _context.ProductionTasks.Remove(orphan);
                    var orphanSplits = splits.Where(s => s.ChildTaskId == orphan.Id).ToList();
                    if (orphanSplits.Any())
                        _context.TaskSplits.RemoveRange(orphanSplits);
                }
                else if (orphan.Status != JobStatus.Completed)
                {
                    await lifecycle.CompleteTaskAsync(orphan.Id, now);
                    var orphanSplits = splits.Where(s => s.ChildTaskId == orphan.Id).ToList();
                    if (orphanSplits.Any())
                        _context.TaskSplits.RemoveRange(orphanSplits);
                }
            }

            await _repo.UpdateTaskAsync(parentTask);
            await _context.SaveChangesAsync();

            await RecalculateParentStatusAsync(parentTask.Id);

            return parentTask;
        }

        private static ProductionTask CreateChildFromPart(ProductionTask parent, SplitPart part) => new()
        {
            DisplayOrder = -1,
            FolderPath = parent.FolderPath,
            FileName = $"{parent.FileName} [{part.TaskType}]",
            Comment = parent.Comment,
            Deadline = parent.Deadline,
            EstimateHours = part.AllocatedHours,
            Type = part.TaskType,
            EmployeeName = part.EmployeeName,
            Status = JobStatus.Assigned,
            Progress = 0,
            ActualHours = 0,
            ParentRowNumber = parent.Id,
            IsSplitTask = true,
            WorkIntervals = new List<WorkInterval>()
        };

        private void ApplyPartToChild(ProductionTask child, ProductionTask parent, SplitPart part)
        {
            child.EstimateHours = part.AllocatedHours;
            child.Type = part.TaskType;
            child.EmployeeName = part.EmployeeName;
            child.Deadline = parent.Deadline;
            child.FolderPath = parent.FolderPath;
            child.FileName = $"{parent.FileName} [{part.TaskType}]";
            child.Comment = parent.Comment;
            child.UpdatedAt = _timeService.Now;
        }

        private static ProductionTask? ResolveChildForPart(
            SplitPart part,
            List<ProductionTask> existingChildren,
            HashSet<int> usedChildIds)
        {
            if (part.ChildTaskId.HasValue && part.ChildTaskId.Value > 0)
            {
                var byId = existingChildren.FirstOrDefault(c =>
                    c.Id == part.ChildTaskId.Value && !usedChildIds.Contains(c.Id));
                if (byId != null) return byId;
            }

            return existingChildren.FirstOrDefault(c =>
                !usedChildIds.Contains(c.Id) && c.EmployeeName == part.EmployeeName);
        }

        private static bool CanRemoveChild(ProductionTask child) =>
            child.Status == JobStatus.Assigned && child.ActualHours < 0.01 && child.Progress < 0.01;

        private async Task<ProductionTask> ConvertToRegularTaskAsync(ProductionTask parent, SplitPart part)
        {
            var now = _timeService.Now;
            var activeChildren = await GetChildTasksAsync(parent.Id);
            var allChildren = await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == parent.Id)
                .ToListAsync();
            var splits = await _context.TaskSplits.Where(ts => ts.ParentRowNumber == parent.Id).ToListAsync();
            var lifecycle = _serviceProvider.GetRequiredService<ITaskLifecycleService>();

            var keptChild = ResolveChildForPart(part, activeChildren, new HashSet<int>());

            foreach (var child in allChildren.Where(c => keptChild == null || c.Id != keptChild.Id))
            {
                if (CanRemoveChild(child))
                {
                    _context.ProductionTasks.Remove(child);
                }
                else if (child.Status != JobStatus.Completed)
                {
                    await lifecycle.CompleteTaskAsync(child.Id, now);
                }
            }

            parent.EmployeeName = part.EmployeeName;
            parent.EstimateHours = part.AllocatedHours;
            parent.Type = part.TaskType ?? string.Empty;
            parent.IsSplitTask = false;
            parent.FileName = ResolveBaseFileName(parent.FileName, keptChild);
            parent.UpdatedAt = now;

            if (keptChild != null)
            {
                parent.Status = keptChild.Status;
                parent.Progress = keptChild.Progress;
                parent.ActualHours = keptChild.ActualHours;
                parent.CompletedAt = keptChild.CompletedAt;

                foreach (var interval in keptChild.WorkIntervals.ToList())
                {
                    interval.ProductionTaskId = parent.Id;
                    await _repo.UpdateWorkIntervalAsync(interval);
                }

                _context.ProductionTasks.Remove(keptChild);
            }
            else
            {
                parent.Status = JobStatus.Assigned;
                parent.Progress = 0;
                parent.ActualHours = 0;
                parent.CompletedAt = null;
            }

            if (splits.Any())
                _context.TaskSplits.RemoveRange(splits);

            await _repo.UpdateTaskAsync(parent);
            await _context.SaveChangesAsync();

            return parent;
        }

        private static string ResolveBaseFileName(string parentFileName, ProductionTask? child)
        {
            if (child != null && !string.IsNullOrEmpty(child.FileName))
            {
                var idx = child.FileName.LastIndexOf(" [", StringComparison.Ordinal);
                if (idx > 0)
                    return child.FileName[..idx];
            }

            return parentFileName;
        }

        private async Task RecalculateParentStatusAsync(int parentId)
        {
            var parent = await _repo.GetTaskByIdAsync(parentId);
            if (parent == null || !parent.IsSplitTask) return;

            var children = await GetChildTasksAsync(parentId);
            if (!children.Any()) return;

            JobStatus newStatus;
            if (children.All(c => c.Status == JobStatus.Completed))
                newStatus = JobStatus.Completed;
            else if (children.Any(c =>
                c.Status is JobStatus.Completed or JobStatus.InProgress or JobStatus.Paused))
                newStatus = JobStatus.InProgress;
            else
                newStatus = JobStatus.Assigned;

            if (parent.Status == newStatus) return;

            parent.Status = newStatus;
            parent.Progress = newStatus == JobStatus.Completed ? 1 : 0;
            parent.CompletedAt = newStatus == JobStatus.Completed ? _timeService.Now : null;
            parent.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(parent);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> AreAllSubtasksCompletedAsync(int parentRowNumber)
        {
            var children = await GetChildTasksAsync(parentRowNumber);
            if (!children.Any()) return true;
            return children.All(t => t.Status == JobStatus.Completed);
        }

        public async Task UpdateParentCompletionStatusAsync(int parentRowNumber)
        {
            await AreAllSubtasksCompletedAsync(parentRowNumber);
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(int parentRowNumber)
        {
            var activeChildIds = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == parentRowNumber)
                .Select(ts => ts.ChildTaskId)
                .ToListAsync();

            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => activeChildIds.Contains(t.Id))
                .ToListAsync();
        }
    }
}
