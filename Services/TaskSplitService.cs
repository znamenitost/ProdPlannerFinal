using ProductionPlanner.Data;
using ProductionPlanner.Models;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Services
{
    public class TaskSplitService : ITaskSplitService
    {
        private readonly IProductionTaskRepository _repo;
        private readonly ApplicationDbContext _context;
        private readonly IAppTimeService _timeService;
        private readonly ITaskNotificationService _notificationService;

        public TaskSplitService(
            IProductionTaskRepository repo,
            ApplicationDbContext context,
            IAppTimeService timeService,
            ITaskNotificationService notificationService)
        {
            _repo = repo;
            _context = context;
            _timeService = timeService;
            _notificationService = notificationService;
        }

        public async Task<ProductionTask> SplitTaskAsync(int parentTaskId, List<SplitPart> parts)
        {
            var parentTask = await _repo.GetTaskByIdAsync(parentTaskId);
            if (parentTask == null)
                throw new Exception($"Задача {parentTaskId} не найдена");

            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            if (Math.Abs(totalAllocated - parentTask.EstimateHours) > 0.01)
                throw new Exception($"Сумма выделенных часов ({totalAllocated}) не равна оценке задачи ({parentTask.EstimateHours})");

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
            if (!parentTask.IsSplitTask || parentTask.ParentRowNumber != null)
                throw new Exception("Задача не является общей");

            if (parts.Count < 2)
                throw new Exception("Общая задача должна содержать минимум двух сотрудников");

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

            foreach (var orphan in existingChildren.Where(c => !usedChildIds.Contains(c.Id)))
            {
                if (CanRemoveChild(orphan))
                {
                    _context.ProductionTasks.Remove(orphan);
                    var orphanSplits = splits.Where(s => s.ChildTaskId == orphan.Id).ToList();
                    if (orphanSplits.Any())
                        _context.TaskSplits.RemoveRange(orphanSplits);
                }
            }

            await _repo.UpdateTaskAsync(parentTask);
            await _context.SaveChangesAsync();

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

        public async Task<bool> AreAllSubtasksCompletedAsync(int parentRowNumber)
        {
            var allTasks = await _repo.GetAllTasksAsync();
            var children = allTasks.Where(t => t.ParentRowNumber == parentRowNumber && t.IsSplitTask).ToList();
            if (!children.Any()) return true;
            return children.All(t => t.Status == JobStatus.Completed);
        }

        public async Task UpdateParentCompletionStatusAsync(int parentRowNumber)
        {
            await AreAllSubtasksCompletedAsync(parentRowNumber);
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(int parentRowNumber)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == parentRowNumber && t.IsSplitTask)
                .ToListAsync();
        }
    }
}
