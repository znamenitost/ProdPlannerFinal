using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Services; 

namespace ProductionPlanner.Data
{
    public class ProductionTaskRepository : IProductionTaskRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IAppTimeService _timeService;

        public ProductionTaskRepository(ApplicationDbContext context, IAppTimeService timeService)
        {
            _context = context;
            _timeService = timeService;
        }

        public async Task<List<ProductionTask>> GetActiveTasksAsync(string employeeName)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.EmployeeName == employeeName
                            && t.Status != JobStatus.Completed
                            && !(t.IsSplitTask && t.ParentRowNumber == null))
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetCompletedTasksAsync(string employeeName)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.EmployeeName == employeeName && t.Status == JobStatus.Completed)
                .ToListAsync();
        }

        public async Task<ProductionTask?> GetTaskByIdAsync(int id)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<ProductionTask?> GetTaskByRowNumberAsync(int rowNumber)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == rowNumber);
        }

        public async Task AddTaskAsync(ProductionTask task)
        {
            task.CreatedAt = _timeService.Now;
            task.UpdatedAt = _timeService.Now;
            await _context.ProductionTasks.AddAsync(task);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateTaskAsync(ProductionTask task)
        {
            task.UpdatedAt = _timeService.Now;
            _context.ProductionTasks.Update(task);

            Console.WriteLine($"[REPO] UpdateTaskAsync: Id={task.Id}, Deadline={task.Deadline}");

            await _context.SaveChangesAsync();

            Console.WriteLine($"[REPO] Сохранение завершено для задачи {task.Id}");
        }
        

        // ./Data/ProductionTaskRepository.cs
// Полный метод DeleteTaskAsync

public async Task DeleteTaskAsync(int id)
{
    var task = await GetTaskByIdAsync(id);
    if (task != null)
    {
        // Если задача является родительской для сплита (IsSplitTask = true), удаляем всех детей
        if (task.IsSplitTask)
        {
            var children = await _context.ProductionTasks
                .Where(t => t.ParentRowNumber == task.Id)
                .ToListAsync();
            if (children.Any())
            {
                _context.ProductionTasks.RemoveRange(children);
                Console.WriteLine($"[DEBUG] Удалено {children.Count} дочерних задач сплита для родителя {id}");
            }
        }
        // Также удаляем записи TaskSplit, связанные с этим родителем (если есть)
        var splits = await _context.TaskSplits.Where(ts => ts.ParentRowNumber == task.Id).ToListAsync();
        if (splits.Any())
        {
            _context.TaskSplits.RemoveRange(splits);
        }

        _context.ProductionTasks.Remove(task);
        await _context.SaveChangesAsync();
    }
}

        public async Task DeleteAllTasksAsync()
        {
            var allTasks = await _context.ProductionTasks.ToListAsync();
            _context.ProductionTasks.RemoveRange(allTasks);
            await _context.SaveChangesAsync();
        }

        public async Task AddWorkIntervalAsync(WorkInterval interval)
        {
            await _context.WorkIntervals.AddAsync(interval);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateWorkIntervalAsync(WorkInterval interval)
        {
            _context.WorkIntervals.Update(interval);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteWorkIntervalAsync(WorkInterval interval)
        {
            _context.WorkIntervals.Remove(interval);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAllWorkIntervalsAsync()
        {
            var allIntervals = await _context.WorkIntervals.ToListAsync();
            _context.WorkIntervals.RemoveRange(allIntervals);
            await _context.SaveChangesAsync();
        }

        public async Task<EmployeeStat?> GetEmployeeStatAsync(string employeeName)
        {
            return await _context.EmployeeStats.FirstOrDefaultAsync(s => s.EmployeeName == employeeName);
        }

        public async Task UpdateEmployeeStatAsync(EmployeeStat stat)
        {
            if (stat.Id == 0)
                await _context.EmployeeStats.AddAsync(stat);
            else
                _context.EmployeeStats.Update(stat);
            await _context.SaveChangesAsync();
        }

        public async Task<List<ProductionTask>> GetAllTasksAsync()
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetRootTasksAsync()
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == null)
                .OrderBy(t => t.DisplayOrder)
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(int parentId)
        {
            var activeChildIds = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == parentId)
                .Select(ts => ts.ChildTaskId)
                .ToListAsync();

            if (!activeChildIds.Any())
                return new List<ProductionTask>();

            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => activeChildIds.Contains(t.Id))
                .ToListAsync();
        }

        public async Task<PaginatedResult<ProductionTask>> GetRootTasksPaginatedAsync(int page, int pageSize)
        {
            var query = _context.ProductionTasks
                .Where(t => t.ParentRowNumber == null)
                .OrderBy(t => t.DisplayOrder);
            
            var totalCount = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            
            return new PaginatedResult<ProductionTask>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<Dictionary<int, List<ProductionTask>>> GetSplitChildrenByParentIdsAsync(IReadOnlyList<int> parentIds)
        {
            if (parentIds.Count == 0)
                return new Dictionary<int, List<ProductionTask>>();

            var splits = await _context.TaskSplits
                .Where(ts => parentIds.Contains(ts.ParentRowNumber))
                .ToListAsync();

            if (splits.Count == 0)
                return new Dictionary<int, List<ProductionTask>>();

            var childIds = splits.Select(s => s.ChildTaskId).ToList();
            var children = await _context.ProductionTasks
                .Where(c => childIds.Contains(c.Id) && c.IsSplitTask)
                .ToListAsync();

            var parentByChildId = splits.ToDictionary(s => s.ChildTaskId, s => s.ParentRowNumber);

            return children
                .Where(c => parentByChildId.ContainsKey(c.Id))
                .GroupBy(c => parentByChildId[c.Id])
                .ToDictionary(g => g.Key, g => g.ToList());
        }

        // Оптимизированный метод ReorderTasksAsync без загрузки всех задач в память
        public async Task ReorderTasksAsync(List<int> orderedIds)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Сбросить DisplayOrder для всех задач, которых нет в списке (ставить большой номер)
                var notListedIds = await _context.ProductionTasks
                    .Where(t => !orderedIds.Contains(t.Id))
                    .Select(t => t.Id)
                    .ToListAsync();

                if (notListedIds.Any())
                {
                    await _context.ProductionTasks
                        .Where(t => notListedIds.Contains(t.Id))
                        .ExecuteUpdateAsync(setter => setter.SetProperty(t => t.DisplayOrder, int.MaxValue));
                }

                // 2. Обновить DisplayOrder для переданных Id по порядку
                for (int i = 0; i < orderedIds.Count; i++)
                {
                    await _context.ProductionTasks
                        .Where(t => t.Id == orderedIds[i])
                        .ExecuteUpdateAsync(setter => setter.SetProperty(t => t.DisplayOrder, i));
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Новые методы для оптимизации календаря
        public async Task<List<ProductionTask>> GetActiveTasksWithIntervalsByEmployeeAsync(string employeeName)
        {
            return await _context.ProductionTasks
                .Where(t => t.EmployeeName == employeeName && t.Status != JobStatus.Completed)
                .ToListAsync();
        }

        public async Task<List<WorkInterval>> GetWorkIntervalsForDateRangeAsync(string employeeName, DateTime start, DateTime end)
        {
            var rangeStart = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(start) : start;
            var rangeEnd = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(end) : end;

            return await _context.WorkIntervals
                .Include(i => i.Task)
                .Where(i => i.Task.EmployeeName == employeeName &&
                            i.StartTime >= rangeStart && i.StartTime < rangeEnd)
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetEmployeeTasksAsync(string employeeName)
        {
            return await _context.ProductionTasks
                .Where(t => t.EmployeeName == employeeName)
                .ToListAsync();
        }

        public async Task ExecuteInTransactionAsync(Func<Task> action)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    await action();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<int> CloseOpenIntervalsAsync(int taskId, DateTime closedAt)
        {
            return await _context.WorkIntervals
                .Where(i => i.ProductionTaskId == taskId && i.EndTime == null)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.EndTime, closedAt));
        }

        public async Task<int> TryTransitionStatusAsync(
            int taskId,
            JobStatus newStatus,
            DateTime updatedAt,
            IReadOnlyList<JobStatus>? expectedStatuses = null,
            TaskStatusPatch? patch = null)
        {
            var query = _context.ProductionTasks.Where(t => t.Id == taskId);

            if (expectedStatuses is { Count: > 0 })
                query = query.Where(t => expectedStatuses.Contains(t.Status));
            else if (newStatus == JobStatus.Completed)
                query = query.Where(t => t.Status != JobStatus.Completed);

            var rows = await query.ExecuteUpdateAsync(s =>
                s.SetProperty(t => t.Status, newStatus)
                    .SetProperty(t => t.UpdatedAt, updatedAt));

            if (rows == 0 || patch == null)
                return rows;

            var patchQuery = _context.ProductionTasks.Where(t => t.Id == taskId);

            if (patch.Progress is double progress)
                await patchQuery.ExecuteUpdateAsync(s => s.SetProperty(t => t.Progress, progress));

            if (patch.CompletedAt is DateTime completedAt)
                await patchQuery.ExecuteUpdateAsync(s => s.SetProperty(t => t.CompletedAt, completedAt));

            if (patch.ClearCompletedAt)
                await patchQuery.ExecuteUpdateAsync(s => s.SetProperty(t => t.CompletedAt, (DateTime?)null));

            if (patch.ActualHours is double actualHours)
                await patchQuery.ExecuteUpdateAsync(s => s.SetProperty(t => t.ActualHours, actualHours));

            return rows;
        }

        public void StageWorkInterval(WorkInterval interval)
        {
            _context.WorkIntervals.Add(interval);
        }

        public Task SaveChangesAsync() => _context.SaveChangesAsync();
    }
}