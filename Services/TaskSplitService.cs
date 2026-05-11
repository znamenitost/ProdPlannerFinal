using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Hubs;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;

namespace ProductionPlanner.Services
{
    public class TaskSplitService : ITaskSplitService
    {
        private readonly IProductionTaskRepository _repo;
        private readonly ApplicationDbContext _context;
        private readonly IAppTimeService _timeService;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly UserManager<User> _userManager;

        public TaskSplitService(
            IProductionTaskRepository repo,
            ApplicationDbContext context,
            IAppTimeService timeService,
            IHubContext<NotificationHub> hubContext,
            UserManager<User> userManager)
        {
            _repo = repo;
            _context = context;
            _timeService = timeService;
            _hubContext = hubContext;
            _userManager = userManager;
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

                // Отправка уведомления сотруднику, которому назначена эта часть
                var userId = await GetUserIdByFullName(part.EmployeeName);
                if (!string.IsNullOrEmpty(userId))
                {
                    var taskTitle = $"{parentTask.TaskDisplayName} [{part.TaskType}]";
                    await _hubContext.Clients.Group(userId).SendAsync("NewTask", childTask.Id, taskTitle, childTask.Deadline);
                    Console.WriteLine($"[NOTIFY] Split notification sent to {part.EmployeeName} (user {userId}) for task {childTask.Id}");
                }
                else
                {
                    Console.WriteLine($"[NOTIFY] User not found for {part.EmployeeName}");
                }
            }

            parentTask.IsSplitTask = true;
            parentTask.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(parentTask);

            await _context.SaveChangesAsync();

            var allRootIds = (await _repo.GetRootTasksAsync()).OrderBy(t => t.DisplayOrder).Select(t => t.Id).ToList();
            await _repo.ReorderTasksAsync(allRootIds);

            return parentTask;
        }

        private async Task<string?> GetUserIdByFullName(string fullName)
        {
            var user = await _userManager.Users.FirstOrDefaultAsync(u => u.FullName == fullName);
            return user?.Id;
        }

        // Остальные методы без изменений
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