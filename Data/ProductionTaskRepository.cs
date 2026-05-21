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

        public async Task<List<ProductionTask>> GetActiveTasksAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.EmployeeName == employeeName
                            && t.Status != JobStatus.Completed
                            && !(t.IsSplitTask && t.ParentRowNumber == null))
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetCompletedTasksAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.EmployeeName == employeeName && t.Status == JobStatus.Completed)
                .ToListAsync(cancellationToken);
        }

        public async Task<ProductionTask?> GetTaskByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        }

        public async Task<ProductionTask?> GetTaskByRowNumberAsync(int rowNumber, CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == rowNumber, cancellationToken);
        }

        public async Task AddTaskAsync(ProductionTask task, CancellationToken cancellationToken = default)
        {
            task.CreatedAt = _timeService.Now;
            task.UpdatedAt = _timeService.Now;
            await _context.ProductionTasks.AddAsync(task, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task UpdateTaskAsync(ProductionTask task, CancellationToken cancellationToken = default)
        {
            task.UpdatedAt = _timeService.Now;
            _context.ProductionTasks.Update(task);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteTaskAsync(int id, CancellationToken cancellationToken = default)
        {
            var task = await GetTaskByIdAsync(id, cancellationToken);
            if (task == null)
                return;

            if (task.IsSplitTask)
            {
                var children = await _context.ProductionTasks
                    .Where(t => t.ParentRowNumber == task.Id)
                    .ToListAsync(cancellationToken);
                if (children.Count > 0)
                    _context.ProductionTasks.RemoveRange(children);
            }

            var splits = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == task.Id)
                .ToListAsync(cancellationToken);
            if (splits.Count > 0)
                _context.TaskSplits.RemoveRange(splits);

            _context.ProductionTasks.Remove(task);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAllTasksAsync(CancellationToken cancellationToken = default)
        {
            var allTasks = await _context.ProductionTasks.ToListAsync(cancellationToken);
            _context.ProductionTasks.RemoveRange(allTasks);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task AddWorkIntervalAsync(WorkInterval interval, CancellationToken cancellationToken = default)
        {
            await _context.WorkIntervals.AddAsync(interval, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task UpdateWorkIntervalAsync(WorkInterval interval, CancellationToken cancellationToken = default)
        {
            _context.WorkIntervals.Update(interval);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteWorkIntervalAsync(WorkInterval interval, CancellationToken cancellationToken = default)
        {
            _context.WorkIntervals.Remove(interval);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAllWorkIntervalsAsync(CancellationToken cancellationToken = default)
        {
            var allIntervals = await _context.WorkIntervals.ToListAsync(cancellationToken);
            _context.WorkIntervals.RemoveRange(allIntervals);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<EmployeeStat?> GetEmployeeStatAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            return await _context.EmployeeStats
                .FirstOrDefaultAsync(s => s.EmployeeName == employeeName, cancellationToken);
        }

        public async Task UpdateEmployeeStatAsync(EmployeeStat stat, CancellationToken cancellationToken = default)
        {
            if (stat.Id == 0)
                await _context.EmployeeStats.AddAsync(stat, cancellationToken);
            else
                _context.EmployeeStats.Update(stat);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetAllTasksAsync(CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetRootTasksAsync(CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == null)
                .OrderBy(t => t.DisplayOrder)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(int parentId, CancellationToken cancellationToken = default)
        {
            var activeChildIds = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == parentId)
                .Select(ts => ts.ChildTaskId)
                .ToListAsync(cancellationToken);

            if (activeChildIds.Count == 0)
                return [];

            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => activeChildIds.Contains(t.Id))
                .ToListAsync(cancellationToken);
        }

        public async Task<PaginatedResult<ProductionTask>> GetRootTasksPaginatedAsync(
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            var query = _context.ProductionTasks
                .Where(t => t.ParentRowNumber == null)
                .OrderBy(t => t.DisplayOrder);

            var totalCount = await query.CountAsync(cancellationToken);
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PaginatedResult<ProductionTask>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<Dictionary<int, List<ProductionTask>>> GetSplitChildrenByParentIdsAsync(
            IReadOnlyList<int> parentIds,
            CancellationToken cancellationToken = default)
        {
            if (parentIds.Count == 0)
                return new Dictionary<int, List<ProductionTask>>();

            var splits = await _context.TaskSplits
                .Where(ts => parentIds.Contains(ts.ParentRowNumber))
                .ToListAsync(cancellationToken);

            if (splits.Count == 0)
                return new Dictionary<int, List<ProductionTask>>();

            var childIds = splits.Select(s => s.ChildTaskId).ToList();
            var children = await _context.ProductionTasks
                .Where(c => childIds.Contains(c.Id) && c.IsSplitTask)
                .ToListAsync(cancellationToken);

            var parentByChildId = splits.ToDictionary(s => s.ChildTaskId, s => s.ParentRowNumber);

            return children
                .Where(c => parentByChildId.ContainsKey(c.Id))
                .GroupBy(c => parentByChildId[c.Id])
                .ToDictionary(g => g.Key, g => g.ToList());
        }

        public async Task ReorderTasksAsync(List<int> orderedIds, CancellationToken cancellationToken = default)
        {
            await ExecuteInTransactionAsync(async ct =>
            {
                var notListedIds = await _context.ProductionTasks
                    .Where(t => !orderedIds.Contains(t.Id))
                    .Select(t => t.Id)
                    .ToListAsync(ct);

                if (notListedIds.Count > 0)
                {
                    await _context.ProductionTasks
                        .Where(t => notListedIds.Contains(t.Id))
                        .ExecuteUpdateAsync(
                            setter => setter.SetProperty(t => t.DisplayOrder, int.MaxValue),
                            ct);
                }

                for (var i = 0; i < orderedIds.Count; i++)
                {
                    await _context.ProductionTasks
                        .Where(t => t.Id == orderedIds[i])
                        .ExecuteUpdateAsync(
                            setter => setter.SetProperty(t => t.DisplayOrder, i),
                            ct);
                }
            }, cancellationToken);
        }

        public async Task<List<ProductionTask>> GetActiveTasksWithIntervalsByEmployeeAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Where(t => t.EmployeeName == employeeName && t.Status != JobStatus.Completed)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<WorkInterval>> GetWorkIntervalsForDateRangeAsync(
            string employeeName,
            DateTime start,
            DateTime end,
            CancellationToken cancellationToken = default)
        {
            var rangeStart = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(start) : start;
            var rangeEnd = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(end) : end;

            return await _context.WorkIntervals
                .Include(i => i.Task)
                .Where(i => i.Task.EmployeeName == employeeName &&
                            i.StartTime >= rangeStart && i.StartTime < rangeEnd)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetEmployeeTasksAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            return await _context.ProductionTasks
                .Where(t => t.EmployeeName == employeeName)
                .ToListAsync(cancellationToken);
        }

        public async Task ExecuteInTransactionAsync(
            Func<CancellationToken, Task> action,
            CancellationToken cancellationToken = default)
        {
            if (_context.Database.CurrentTransaction != null)
            {
                await action(cancellationToken);
                return;
            }

            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    await action(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                catch
                {
                    await transaction.RollbackAsync(cancellationToken);
                    throw;
                }
            });
        }

        public async Task<int> CloseOpenIntervalsAsync(
            int taskId,
            DateTime closedAt,
            CancellationToken cancellationToken = default)
        {
            var end = ToDbDateTime(closedAt);
            return await _context.WorkIntervals
                .Where(i => i.ProductionTaskId == taskId && i.EndTime == null)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.EndTime, end), cancellationToken);
        }

        public async Task<int> TryTransitionStatusAsync(
            int taskId,
            JobStatus newStatus,
            DateTime updatedAt,
            IReadOnlyList<JobStatus>? expectedStatuses = null,
            TaskStatusPatch? patch = null,
            CancellationToken cancellationToken = default)
        {
            var updated = ToDbDateTime(updatedAt);
            var query = _context.ProductionTasks.Where(t => t.Id == taskId);

            if (expectedStatuses is { Count: > 0 })
                query = query.Where(t => expectedStatuses.Contains(t.Status));
            else if (newStatus == JobStatus.Completed)
                query = query.Where(t => t.Status != JobStatus.Completed);

            var rows = await query.ExecuteUpdateAsync(s =>
                s.SetProperty(t => t.Status, newStatus)
                    .SetProperty(t => t.UpdatedAt, updated),
                cancellationToken);

            if (rows == 0 || patch == null)
                return rows;

            var patchQuery = _context.ProductionTasks.Where(t => t.Id == taskId);

            if (patch.Progress is double progress)
            {
                await patchQuery.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Progress, progress),
                    cancellationToken);
            }

            if (patch.CompletedAt is DateTime completedAt)
            {
                var completed = ToDbDateTime(completedAt);
                await patchQuery.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.CompletedAt, completed),
                    cancellationToken);
            }

            if (patch.ClearCompletedAt)
            {
                await patchQuery.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.CompletedAt, (DateTime?)null),
                    cancellationToken);
            }

            if (patch.ActualHours is double actualHours)
            {
                await patchQuery.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.ActualHours, actualHours),
                    cancellationToken);
            }

            return rows;
        }

        private DateTime ToDbDateTime(DateTime value) =>
            _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(value) : value;

        public void StageWorkInterval(WorkInterval interval) =>
            _context.WorkIntervals.Add(interval);

        public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
            _context.SaveChangesAsync(cancellationToken);
    }
}
