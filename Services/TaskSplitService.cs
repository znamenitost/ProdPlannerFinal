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

        public TaskSplitService(IProductionTaskRepository repo, ApplicationDbContext context, IAppTimeService timeService)
        {
            _repo = repo;
            _context = context;
            _timeService = timeService;
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
                var childTask = new ProductionTask
                {
                    DisplayOrder = -1,
                    FolderPath = parentTask.FolderPath,
                    FileName = $"{parentTask.FileName} [{part.TaskType}]",
                    Comment = parentTask.Comment,
                    Deadline = parentTask.Deadline,
                    EstimateHours = part.AllocatedHours,
                    Type = part.TaskType,
                    EmployeeName = part.EmployeeName,
                    Status = JobStatus.Assigned,
                    Progress = 0,
                    ActualHours = 0,
                    ParentRowNumber = parentTask.Id,
                    IsSplitTask = true,
                    CreatedAt = _timeService.Now,
                    UpdatedAt = _timeService.Now,
                    WorkIntervals = new List<WorkInterval>()
                };
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
            }

            parentTask.IsSplitTask = true;
            parentTask.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(parentTask);

            await _context.SaveChangesAsync();

            var allRootIds = (await _repo.GetRootTasksAsync()).OrderBy(t => t.DisplayOrder).Select(t => t.Id).ToList();
            await _repo.ReorderTasksAsync(allRootIds);

            return parentTask;
        }

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