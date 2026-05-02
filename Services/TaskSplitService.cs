using ProductionPlanner.Data;
using ProductionPlanner.Models;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Services
{
    public class TaskSplitService : ITaskSplitService
    {
        private readonly IProductionTaskRepository _repo;
        private readonly ITableRowRepository _tableRepo;
        private readonly ApplicationDbContext _context;

        public TaskSplitService(
            IProductionTaskRepository repo, 
            ITableRowRepository tableRepo,
            ApplicationDbContext context)
        {
            _repo = repo;
            _tableRepo = tableRepo;
            _context = context;
        }

        public async Task<ProductionTask> SplitTaskAsync(int parentTaskId, List<SplitPart> parts)
        {
            var parentTask = await _repo.GetTaskByIdAsync(parentTaskId);
            if (parentTask == null)
                throw new Exception($"Задача {parentTaskId} не найдена");

            var parentTableRow = await _tableRepo.GetRowByIdAsync(parentTask.RowNumber);
            if (parentTableRow == null)
                throw new Exception($"Строка таблицы {parentTask.RowNumber} не найдена");

            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            if (Math.Abs(totalAllocated - parentTask.EstimateHours) > 0.01)
                throw new Exception($"Сумма выделенных часов ({totalAllocated}) не равна оценке задачи ({parentTask.EstimateHours})");

            foreach (var part in parts)
            {
                // Дочерняя строка в таблице
                var childTableRow = new TableRow
                {
                    DisplayOrder = -1,
                    FolderPath = parentTableRow.FolderPath,
                    FileName = $"{parentTableRow.FileName} [{part.TaskType}]",
                    Comment = parentTableRow.Comment,
                    StatusText = "",
                    Deadline = parentTableRow.Deadline,
                    EstimateHours = part.AllocatedHours,
                    Type = part.TaskType,
                    EmployeeName = part.EmployeeName,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsFromGoogleSheets = false,
                    ParentRowNumber = parentTableRow.Id
                };
                await _tableRepo.AddRowAsync(childTableRow);
                
                // Дочерняя ProductionTask
                var childTask = new ProductionTask
                {
                    RowNumber = childTableRow.Id,
                    EmployeeName = part.EmployeeName,
                    Title = $"{parentTask.Title} [{part.TaskType}]",
                    File = parentTask.File,
                    Comment = parentTask.Comment,
                    Type = part.TaskType,
                    Deadline = parentTask.Deadline,
                    EstimateHours = part.AllocatedHours,
                    Status = JobStatus.Assigned,
                    Progress = 0,
                    ActualHours = 0,
                    ParentRowNumber = parentTask.RowNumber,
                    IsSplitTask = true
                };
                await _repo.AddTaskAsync(childTask);
                
                // Связь
                var split = new TaskSplit
                {
                    ParentRowNumber = parentTask.RowNumber,
                    ChildTaskId = childTask.Id,
                    AssignedTo = part.EmployeeName,
                    SplitType = part.TaskType,
                    AllocatedHours = part.AllocatedHours
                };
                await _context.TaskSplits.AddAsync(split);
            }
            
            // Удаляем родительскую ProductionTask
            await _repo.DeleteTaskAsync(parentTaskId);
            
            // Обновляем родительскую строку
            parentTableRow.StatusText = $"Разделена на {parts.Count}";
            await _tableRepo.UpdateRowAsync(parentTableRow);
            
            await _context.SaveChangesAsync();
            
            return parentTask;
        }

        public async Task<bool> AreAllSubtasksCompletedAsync(int parentRowNumber)
        {
            var allTableRows = await _tableRepo.GetAllRowsAsync();
            var children = allTableRows.Where(r => r.ParentRowNumber == parentRowNumber).ToList();
            
            if (!children.Any()) return false;
            
            bool allCompleted = children.All(r => r.StatusText == "Готово");
            
            if (allCompleted)
            {
                var parentRow = await _tableRepo.GetRowByIdAsync(parentRowNumber);
                if (parentRow != null && parentRow.StatusText != "Готово")
                {
                    parentRow.StatusText = "Готово";
                    await _tableRepo.UpdateRowAsync(parentRow);
                }
            }
            
            return allCompleted;
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