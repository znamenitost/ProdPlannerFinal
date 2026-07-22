using System.Collections.Concurrent;
using System.Text;
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
        private static readonly ConcurrentDictionary<int, SemaphoreSlim> LifecycleLocks = new();
        /// <summary>
        /// Stack of held task ids for nested locks (e.g. child lifecycle → parent status sync).
        /// Semaphores are kept in the dictionary for process lifetime — never disposed —
        /// to avoid TOCTOU races under concurrent WaitAsync.
        /// </summary>
        private static readonly AsyncLocal<Stack<int>?> HeldLifecycleLockTaskIds = new();
        private static readonly SemaphoreSlim DisplayOrderLock = new(1, 1);
        private const long DisplayOrderAdvisoryLockKey = 7_326_001L;

        public ProductionTaskRepository(ApplicationDbContext context, IAppTimeService timeService)
        {
            _context = context;
            _timeService = timeService;
        }

        public async Task<List<ProductionTask>> GetActiveTasksAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            return await GetActiveTasksForEmployeesAsync([employeeName], cancellationToken);
        }

        public async Task<List<ProductionTask>> GetActiveTasksForEmployeesAsync(
            IReadOnlyList<string> employeeNames,
            CancellationToken cancellationToken = default)
        {
            if (employeeNames.Count == 0)
                return [];

            return await _context.ProductionTasks
                .AsNoTracking()
                .Where(t => employeeNames.Contains(t.EmployeeName)
                            && !t.HiddenFromTaskTable
                            && (t.Status != JobStatus.Completed || t.IsFuss)
                            && !(t.IsSplitTask && t.ParentRowNumber == null))
                .ToListAsync(cancellationToken);
        }

        public async Task<CompletedTasksAggregateStats> GetCompletedTasksStatsAsync(
            string employeeName,
            DateTime? completedFrom = null,
            DateTime? completedTo = null,
            CancellationToken cancellationToken = default)
        {
            var query = CompletedTasksQuery(employeeName);
            if (completedFrom.HasValue || completedTo.HasValue)
            {
                var rangeStart = completedFrom.HasValue ? ToDbDateTime(completedFrom.Value) : (DateTime?)null;
                var rangeEnd = completedTo.HasValue ? ToDbDateTime(completedTo.Value) : (DateTime?)null;

                query = query.Where(t =>
                    (!rangeStart.HasValue || (t.CompletedAt ?? t.UpdatedAt) >= rangeStart.Value)
                    && (!rangeEnd.HasValue || (t.CompletedAt ?? t.UpdatedAt) < rangeEnd.Value));
            }

            var aggregates = await query
                .GroupBy(_ => 1)
                .Select(g => new CompletedTasksAggregateStats
                {
                    TotalTasks = g.Count(),
                    TotalEstimate = g.Sum(t => t.EstimateHours),
                    TotalActual = g.Sum(t => t.ActualHours)
                })
                .ToListAsync(cancellationToken);

            return aggregates.FirstOrDefault() ?? new CompletedTasksAggregateStats();
        }

        public async Task<PaginatedResult<ProductionTask>> GetCompletedTasksPaginatedAsync(
            string employeeName,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            var query = CompletedTasksQuery(employeeName)
                .OrderByDescending(t => t.CompletedAt ?? t.UpdatedAt)
                .ThenByDescending(t => t.Id);

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

        public async Task<List<WorkInterval>> GetWorkIntervalsForTaskIdsAsync(
            IReadOnlyList<int> taskIds,
            CancellationToken cancellationToken = default)
        {
            if (taskIds.Count == 0)
                return [];

            return await _context.WorkIntervals
                .AsNoTracking()
                .Where(i => taskIds.Contains(i.ProductionTaskId))
                .OrderBy(i => i.StartTime)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetTasksByIdsAsync(
            IReadOnlyList<int> taskIds,
            CancellationToken cancellationToken = default)
        {
            if (taskIds.Count == 0)
                return [];

            return await _context.ProductionTasks
                .AsNoTracking()
                .Where(t => taskIds.Contains(t.Id))
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ProductionTask>> GetEmployeeTasksForCalendarWeekAsync(
            string employeeName,
            DateTime weekStart,
            DateTime weekEnd,
            CancellationToken cancellationToken = default)
        {
            var rangeStart = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(weekStart) : weekStart;
            var rangeEnd = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(weekEnd) : weekEnd;

            var taskIdsWithIntervals = await _context.WorkIntervals
                .AsNoTracking()
                .Where(i => i.Task.EmployeeName == employeeName
                    && i.StartTime < rangeEnd
                    && (i.EndTime == null || i.EndTime > rangeStart))
                .Select(i => i.ProductionTaskId)
                .Distinct()
                .ToListAsync(cancellationToken);

            return await _context.ProductionTasks
                .AsNoTracking()
                .Where(t => t.EmployeeName == employeeName && (
                    taskIdsWithIntervals.Contains(t.Id)
                    || (t.Status != JobStatus.Completed && !(t.IsSplitTask && t.ParentRowNumber == null))
                    || (t.Deadline >= rangeStart && t.Deadline < rangeEnd)
                    || (t.Status == JobStatus.Completed
                        && t.CompletedAt != null
                        && t.CompletedAt >= rangeStart
                        && t.CompletedAt < rangeEnd)))
                .ToListAsync(cancellationToken);
        }

        public async Task AppendRootDisplayOrderAsync(int rootTaskId, CancellationToken cancellationToken = default)
        {
            await DisplayOrderLock.WaitAsync(cancellationToken);
            try
            {
                await ExecuteInTransactionAsync(async ct =>
                {
                    await AcquireDisplayOrderDbLockAsync(ct);

                    var maxOrder = await _context.ProductionTasks
                        .AsNoTracking()
                        .Where(t => t.ParentRowNumber == null)
                        .MaxAsync(t => (int?)t.DisplayOrder, ct) ?? -1;

                    await _context.ProductionTasks
                        .Where(t => t.Id == rootTaskId && t.ParentRowNumber == null)
                        .ExecuteUpdateAsync(
                            s => s.SetProperty(t => t.DisplayOrder, maxOrder + 1),
                            ct);
                }, cancellationToken);
            }
            finally
            {
                DisplayOrderLock.Release();
            }
        }

        private async Task AcquireDisplayOrderDbLockAsync(CancellationToken cancellationToken)
        {
            if (!_context.Database.IsNpgsql())
                return;

            await _context.Database.ExecuteSqlRawAsync(
                $"SELECT pg_advisory_xact_lock({DisplayOrderAdvisoryLockKey})",
                cancellationToken);
        }

        private IQueryable<ProductionTask> CompletedTasksQuery(string employeeName) =>
            _context.ProductionTasks
                .AsNoTracking()
                .Where(t => t.EmployeeName == employeeName
                            && t.Status == JobStatus.Completed
                            && !(t.IsSplitTask && t.ParentRowNumber == null));

        public async Task<ProductionTask?> GetTaskByIdAsync(
            int id,
            CancellationToken cancellationToken = default,
            bool includeIntervals = false)
        {
            var query = _context.ProductionTasks.AsNoTracking().AsQueryable();
            if (includeIntervals)
                query = query.Include(t => t.WorkIntervals);
            return await query.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        }

        public async Task<ProductionTask?> GetTaskByRowNumberAsync(
            int rowNumber,
            CancellationToken cancellationToken = default,
            bool includeIntervals = false)
        {
            var query = _context.ProductionTasks.AsNoTracking().AsQueryable();
            if (includeIntervals)
                query = query.Include(t => t.WorkIntervals);
            return await query.FirstOrDefaultAsync(t => t.Id == rowNumber, cancellationToken);
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

            var tracked = await GetTrackedTaskAsync(task.Id, cancellationToken);
            if (tracked == null)
                throw new InvalidOperationException($"Задача {task.Id} не найдена");

            if (!ReferenceEquals(tracked, task))
                _context.Entry(tracked).CurrentValues.SetValues(task);

            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task UpdateTaskTableFieldsAsync(
            ProductionTask task,
            bool includeStatusFields = false,
            CancellationToken cancellationToken = default)
        {
            var updatedAt = ToDbDateTime(task.UpdatedAt == default ? _timeService.Now : task.UpdatedAt);
            var deadline = task.Deadline.HasValue ? ToDbDateTime(task.Deadline.Value) : (DateTime?)null;
            var completedAt = task.CompletedAt.HasValue ? ToDbDateTime(task.CompletedAt.Value) : (DateTime?)null;
            var testPhaseCompletedAt = task.TestPhaseCompletedAt.HasValue
                ? ToDbDateTime(task.TestPhaseCompletedAt.Value)
                : (DateTime?)null;

            var query = _context.ProductionTasks.Where(t => t.Id == task.Id);

            if (includeStatusFields)
            {
                await query.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.FolderPath, task.FolderPath)
                        .SetProperty(t => t.FileName, task.FileName)
                        .SetProperty(t => t.Comment, task.Comment)
                        .SetProperty(t => t.Deadline, deadline)
                        .SetProperty(t => t.EstimateHours, task.EstimateHours)
                        .SetProperty(t => t.Type, task.Type)
                        .SetProperty(t => t.EmployeeName, task.EmployeeName)
                        .SetProperty(t => t.ParentRowNumber, task.ParentRowNumber)
                        .SetProperty(t => t.Status, task.Status)
                        .SetProperty(t => t.IsPriorityMarked, task.IsPriorityMarked)
                        .SetProperty(t => t.CommentEditedViaDialog, task.CommentEditedViaDialog)
                        .SetProperty(t => t.Progress, task.Progress)
                        .SetProperty(t => t.ActualHours, task.ActualHours)
                        .SetProperty(t => t.CompletedAt, completedAt)
                        .SetProperty(t => t.WorkPhase, task.WorkPhase)
                        .SetProperty(t => t.TestPhaseCompletedAt, testPhaseCompletedAt)
                        .SetProperty(t => t.UpdatedAt, updatedAt),
                    cancellationToken);
                return;
            }

            await query.ExecuteUpdateAsync(
                s => s.SetProperty(t => t.FolderPath, task.FolderPath)
                    .SetProperty(t => t.FileName, task.FileName)
                    .SetProperty(t => t.Comment, task.Comment)
                    .SetProperty(t => t.Deadline, deadline)
                    .SetProperty(t => t.EstimateHours, task.EstimateHours)
                    .SetProperty(t => t.Type, task.Type)
                    .SetProperty(t => t.EmployeeName, task.EmployeeName)
                    .SetProperty(t => t.ParentRowNumber, task.ParentRowNumber)
                    .SetProperty(t => t.IsPriorityMarked, task.IsPriorityMarked)
                    .SetProperty(t => t.CommentEditedViaDialog, task.CommentEditedViaDialog)
                    .SetProperty(t => t.UpdatedAt, updatedAt),
                cancellationToken);
        }

        public async Task DeleteTaskAsync(int id, CancellationToken cancellationToken = default)
        {
            await ExecuteInTransactionAsync(async ct =>
            {
                var task = await _context.ProductionTasks
                    .FirstOrDefaultAsync(t => t.Id == id, ct);
                if (task == null)
                    return;

                var closedAt = _timeService.Now;
                var taskIdsToClose = new List<int> { id };

                if (task.IsSplitTask)
                {
                    var childIds = await _context.ProductionTasks
                        .Where(t => t.ParentRowNumber == task.Id)
                        .Select(t => t.Id)
                        .ToListAsync(ct);
                    taskIdsToClose.AddRange(childIds);
                }

                foreach (var taskId in taskIdsToClose.Distinct())
                    await CloseOpenIntervalsAsync(taskId, closedAt, ct);

                var splitsAsChild = await _context.TaskSplits
                    .Where(ts => ts.ChildTaskId == id)
                    .ToListAsync(ct);
                if (splitsAsChild.Count > 0)
                    _context.TaskSplits.RemoveRange(splitsAsChild);

                if (task.IsSplitTask)
                {
                    var children = await _context.ProductionTasks
                        .Where(t => t.ParentRowNumber == task.Id)
                        .ToListAsync(ct);
                    if (children.Count > 0)
                        _context.ProductionTasks.RemoveRange(children);
                }

                var splits = await _context.TaskSplits
                    .Where(ts => ts.ParentRowNumber == task.Id)
                    .ToListAsync(ct);
                if (splits.Count > 0)
                    _context.TaskSplits.RemoveRange(splits);

                _context.ProductionTasks.Remove(task);
                await _context.SaveChangesAsync(ct);
            }, cancellationToken);
        }

        public async Task DetachTasksFromSplitAsync(
            IReadOnlyList<int> childTaskIds,
            CancellationToken cancellationToken = default)
        {
            if (childTaskIds.Count == 0)
                return;

            var ids = childTaskIds.Distinct().ToList();
            await ExecuteInTransactionAsync(async ct =>
            {
                await _context.TaskSplits
                    .Where(ts => ids.Contains(ts.ChildTaskId))
                    .ExecuteDeleteAsync(ct);

                var updatedAt = ToDbDateTime(_timeService.Now);
                await _context.ProductionTasks
                    .Where(t => ids.Contains(t.Id))
                    .ExecuteUpdateAsync(
                        s => s.SetProperty(t => t.ParentRowNumber, (int?)null)
                            .SetProperty(t => t.IsSplitTask, false)
                            .SetProperty(t => t.SupplyMode, SupplyMode.None)
                            .SetProperty(t => t.UpdatedAt, updatedAt),
                        ct);
            }, cancellationToken);
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

        public void StageWorkIntervalForUpdate(WorkInterval interval) =>
            _context.WorkIntervals.Update(interval);

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
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.EmployeeName == employeeName, cancellationToken);
        }

        public async Task UpdateEmployeeStatAsync(EmployeeStat stat, CancellationToken cancellationToken = default)
        {
            if (stat.Id == 0)
            {
                await _context.EmployeeStats.AddAsync(stat, cancellationToken);
            }
            else
            {
                var tracked = _context.EmployeeStats.Local.FirstOrDefault(e => e.Id == stat.Id);
                if (tracked == null)
                {
                    tracked = await _context.EmployeeStats
                        .FirstOrDefaultAsync(e => e.Id == stat.Id, cancellationToken);
                }

                if (tracked == null)
                    throw new InvalidOperationException($"Статистика сотрудника {stat.Id} не найдена");

                tracked.EmployeeName = stat.EmployeeName;
                tracked.TotalSavedHours = stat.TotalSavedHours;
                tracked.TodaySavedHours = stat.TodaySavedHours;
                tracked.LastResetDate = stat.LastResetDate;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        private async Task<ProductionTask?> GetTrackedTaskAsync(int id, CancellationToken cancellationToken)
        {
            var tracked = _context.ProductionTasks.Local.FirstOrDefault(e => e.Id == id);
            if (tracked != null)
                return tracked;

            return await _context.ProductionTasks
                .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(int parentId, CancellationToken cancellationToken = default)
        {
            return await _context.TaskSplits
                .AsNoTracking()
                .Where(ts => ts.ParentRowNumber == parentId)
                .Select(ts => ts.ChildTask)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<TaskSplit>> GetTaskSplitsByParentIdAsync(
            int parentId,
            CancellationToken cancellationToken = default)
        {
            return await _context.TaskSplits
                .AsNoTracking()
                .Where(ts => ts.ParentRowNumber == parentId)
                .OrderBy(ts => ts.SequenceOrder)
                .ThenBy(ts => ts.Id)
                .ToListAsync(cancellationToken);
        }

        public async Task<Dictionary<int, (SupplyMode SupplyMode, int SequenceOrder)>> GetTaskSplitMetadataByChildTaskIdsAsync(
            IReadOnlyList<int> childTaskIds,
            CancellationToken cancellationToken = default)
        {
            if (childTaskIds.Count == 0)
                return new Dictionary<int, (SupplyMode SupplyMode, int SequenceOrder)>();

            var rows = await (
                from split in _context.TaskSplits.AsNoTracking()
                join parent in _context.ProductionTasks.AsNoTracking()
                    on split.ParentRowNumber equals parent.Id
                where childTaskIds.Contains(split.ChildTaskId)
                select new
                {
                    split.ChildTaskId,
                    parent.SupplyMode,
                    split.SequenceOrder
                })
                .ToListAsync(cancellationToken);

            return rows.ToDictionary(
                row => row.ChildTaskId,
                row => (row.SupplyMode, row.SequenceOrder));
        }

        public async Task<PaginatedResult<ProductionTask>> GetRootTasksPaginatedAsync(
            int page,
            int pageSize,
            bool excludeCompleted = false,
            string? search = null,
            bool includeFuss = false,
            string? fussViewerEmployeeName = null,
            CancellationToken cancellationToken = default)
        {
            var query = _context.ProductionTasks
                .AsNoTracking()
                .Where(t => t.ParentRowNumber == null && !t.HiddenFromTaskTable);

            if (!includeFuss)
            {
                query = query.Where(t => !t.IsFuss);
            }
            else if (!string.IsNullOrWhiteSpace(fussViewerEmployeeName))
            {
                // Сотрудник: обычные задачи + только своя суета.
                query = query.Where(t =>
                    !t.IsFuss
                    || t.EmployeeName == fussViewerEmployeeName);
            }

            if (excludeCompleted)
            {
                query = query.Where(t =>
                    t.IsFuss
                    || (t.Status != JobStatus.Completed
                        && (!t.IsSplitTask
                            || !_context.TaskSplits.Any(s => s.ParentRowNumber == t.Id)
                            || _context.TaskSplits
                                .Where(s => s.ParentRowNumber == t.Id)
                                .Join(
                                    _context.ProductionTasks,
                                    s => s.ChildTaskId,
                                    c => c.Id,
                                    (s, c) => c)
                                .Any(c => c.Status != JobStatus.Completed))));
            }

            query = query.ApplyToRootTasks(_context, search);

            query = query
                .OrderBy(t => t.Status == JobStatus.Completed && !t.IsFuss)
                .ThenByDescending(t => t.DisplayOrder)
                .ThenByDescending(t => t.Id);

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

        public async Task<ProductionTask?> GetFussTaskByEmployeeAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(employeeName))
                return null;

            return await _context.ProductionTasks
                .AsNoTracking()
                .Where(t => t.IsFuss
                    && !t.HiddenFromTaskTable
                    && t.ParentRowNumber == null
                    && t.EmployeeName == employeeName)
                .OrderBy(t => t.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task HideDuplicateFussTasksAsync(
            string employeeName,
            int keepTaskId,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(employeeName))
                return;

            await _context.ProductionTasks
                .Where(t => t.IsFuss
                    && !t.HiddenFromTaskTable
                    && t.ParentRowNumber == null
                    && t.EmployeeName == employeeName
                    && t.Id != keepTaskId)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.HiddenFromTaskTable, true)
                        .SetProperty(t => t.UpdatedAt, ToDbDateTime(_timeService.Now)),
                    cancellationToken);
        }

        public async Task HideTaskFromTableAsync(
            int taskId,
            CancellationToken cancellationToken = default)
        {
            await _context.ProductionTasks
                .Where(t => t.Id == taskId)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.HiddenFromTaskTable, true)
                        .SetProperty(t => t.UpdatedAt, ToDbDateTime(_timeService.Now)),
                    cancellationToken);
        }

        public async Task<Dictionary<int, List<ProductionTask>>> GetSplitChildrenByParentIdsAsync(
            IReadOnlyList<int> parentIds,
            CancellationToken cancellationToken = default)
        {
            if (parentIds.Count == 0)
                return new Dictionary<int, List<ProductionTask>>();

            var splits = await _context.TaskSplits
                .AsNoTracking()
                .Where(ts => parentIds.Contains(ts.ParentRowNumber))
                .ToListAsync(cancellationToken);

            if (splits.Count == 0)
                return new Dictionary<int, List<ProductionTask>>();

            var childIds = splits.Select(s => s.ChildTaskId).ToList();
            var children = await _context.ProductionTasks
                .AsNoTracking()
                .Where(c => childIds.Contains(c.Id) && c.IsSplitTask)
                .ToListAsync(cancellationToken);

            var parentByChildId = splits.ToDictionary(s => s.ChildTaskId, s => s.ParentRowNumber);

            return children
                .Where(c => parentByChildId.ContainsKey(c.Id))
                .GroupBy(c => parentByChildId[c.Id])
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var splitOrder = splits
                            .Where(s => s.ParentRowNumber == g.Key)
                            .ToDictionary(s => s.ChildTaskId, s => s.SequenceOrder);
                        return g
                            .OrderBy(c => splitOrder.GetValueOrDefault(c.Id, int.MaxValue))
                            .ThenBy(c => c.Id)
                            .ToList();
                    });
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

                if (orderedIds.Count > 0)
                {
                    await ApplyDisplayOrderBulkUpdateAsync(orderedIds, ct);
                }
            }, cancellationToken);
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
                .AsNoTracking()
                .Where(i => i.Task.EmployeeName == employeeName &&
                            i.StartTime < rangeEnd &&
                            (i.EndTime == null || i.EndTime > rangeStart))
                .OrderBy(i => i.StartTime)
                .ToListAsync(cancellationToken);
        }

        public async Task<LunchInterval?> GetOpenLunchIntervalAsync(
            string employeeName,
            CancellationToken cancellationToken = default)
        {
            var rows = await _context.LunchIntervals
                .AsNoTracking()
                .Where(i => i.EmployeeName == employeeName && i.EndTime == null)
                .OrderByDescending(i => i.StartTime)
                .Take(1)
                .ToListAsync(cancellationToken);
            return rows.Count > 0 ? rows[0] : null;
        }

        public async Task<List<LunchInterval>> GetLunchIntervalsForDateRangeAsync(
            string employeeName,
            DateTime start,
            DateTime end,
            CancellationToken cancellationToken = default)
        {
            var rangeStart = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(start) : start;
            var rangeEnd = _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(end) : end;

            return await _context.LunchIntervals
                .AsNoTracking()
                .Where(i => i.EmployeeName == employeeName &&
                            i.StartTime < rangeEnd &&
                            (i.EndTime == null || i.EndTime > rangeStart))
                .OrderBy(i => i.StartTime)
                .ToListAsync(cancellationToken);
        }

        public async Task AddLunchIntervalAsync(
            LunchInterval interval,
            CancellationToken cancellationToken = default)
        {
            interval.StartTime = ToDbDateTime(interval.StartTime);
            if (interval.EndTime.HasValue)
                interval.EndTime = ToDbDateTime(interval.EndTime.Value);
            _context.LunchIntervals.Add(interval);
            await _context.SaveChangesAsync(cancellationToken);
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

        public async Task ExecuteWithTaskLifecycleLockAsync(
            int taskId,
            Func<CancellationToken, Task> action,
            CancellationToken cancellationToken = default)
        {
            var held = HeldLifecycleLockTaskIds.Value;
            if (held != null && held.Contains(taskId))
            {
                await action(cancellationToken);
                return;
            }

            var sem = LifecycleLocks.GetOrAdd(taskId, _ => new SemaphoreSlim(1, 1));
            await sem.WaitAsync(cancellationToken);
            held = HeldLifecycleLockTaskIds.Value ?? new Stack<int>();
            held.Push(taskId);
            HeldLifecycleLockTaskIds.Value = held;
            try
            {
                await ExecuteInTransactionAsync(async ct =>
                {
                    if (_context.Database.IsNpgsql())
                    {
                        await _context.Database.ExecuteSqlInterpolatedAsync(
                            $"SELECT pg_advisory_xact_lock({taskId})");
                    }

                    await action(ct);
                }, cancellationToken);
            }
            finally
            {
                if (held.Count > 0 && held.Peek() == taskId)
                    held.Pop();
                if (held.Count == 0)
                    HeldLifecycleLockTaskIds.Value = null;
                sem.Release();
            }
        }

        private async Task ApplyDisplayOrderBulkUpdateAsync(
            IReadOnlyList<int> orderedIds,
            CancellationToken cancellationToken)
        {
            var sql = new StringBuilder();
            sql.Append("UPDATE \"ProductionTasks\" SET \"DisplayOrder\" = CASE ");
            var args = new List<object>(orderedIds.Count * 2);

            for (var i = 0; i < orderedIds.Count; i++)
            {
                sql.Append($"WHEN \"Id\" = {{{i}}} THEN {i} ");
                args.Add(orderedIds[i]);
            }

            sql.Append("END WHERE \"Id\" IN (");
            for (var i = 0; i < orderedIds.Count; i++)
            {
                if (i > 0) sql.Append(", ");
                sql.Append($"{{{args.Count}}}");
                args.Add(orderedIds[i]);
            }

            sql.Append(')');
            await _context.Database.ExecuteSqlRawAsync(sql.ToString(), args, cancellationToken);
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

        public async Task<List<int>> GetTaskIdsWithOpenWorkIntervalsAsync(
            CancellationToken cancellationToken = default)
        {
            return await _context.WorkIntervals
                .Where(i => i.EndTime == null)
                .Select(i => i.ProductionTaskId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        public async Task<int> CloseOpenLunchIntervalsAsync(
            string employeeName,
            DateTime closedAt,
            CancellationToken cancellationToken = default)
        {
            var end = ToDbDateTime(closedAt);
            return await _context.LunchIntervals
                .Where(i => i.EmployeeName == employeeName && i.EndTime == null)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.EndTime, end), cancellationToken);
        }

        public async Task<IReadOnlyList<string>> CloseAllOpenLunchIntervalsAsync(
            DateTime closedAt,
            CancellationToken cancellationToken = default)
        {
            var employees = await _context.LunchIntervals
                .Where(i => i.EndTime == null)
                .Select(i => i.EmployeeName)
                .Distinct()
                .ToListAsync(cancellationToken);
            if (employees.Count == 0)
                return employees;

            var end = ToDbDateTime(closedAt);
            await _context.LunchIntervals
                .Where(i => i.EndTime == null)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.EndTime, end), cancellationToken);
            return employees;
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

            if (patch == null)
            {
                return await query.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Status, newStatus)
                        .SetProperty(t => t.UpdatedAt, updated),
                    cancellationToken);
            }

            if (patch is { Progress: 1, CompletedAt: not null, ActualHours: not null })
            {
                var completedAt = ToDbDateTime(patch.CompletedAt.Value);
                var actualHours = patch.ActualHours.Value;
                return await query.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Status, newStatus)
                        .SetProperty(t => t.UpdatedAt, updated)
                        .SetProperty(t => t.Progress, 1.0)
                        .SetProperty(t => t.CompletedAt, completedAt)
                        .SetProperty(t => t.ActualHours, actualHours),
                    cancellationToken);
            }

            if (patch is { Progress: 1, CompletedAt: not null, ClearCompletedAt: false })
            {
                var completedAt = ToDbDateTime(patch.CompletedAt.Value);
                return await query.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Status, newStatus)
                        .SetProperty(t => t.UpdatedAt, updated)
                        .SetProperty(t => t.Progress, 1.0)
                        .SetProperty(t => t.CompletedAt, completedAt),
                    cancellationToken);
            }

            if (patch is { Progress: 0, ClearCompletedAt: true })
            {
                return await query.ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Status, newStatus)
                        .SetProperty(t => t.UpdatedAt, updated)
                        .SetProperty(t => t.Progress, 0.0)
                        .SetProperty(t => t.CompletedAt, (DateTime?)null),
                    cancellationToken);
            }

            return await query.ExecuteUpdateAsync(
                s => s.SetProperty(t => t.Status, newStatus)
                    .SetProperty(t => t.UpdatedAt, updated),
                cancellationToken);
        }

        public async Task<int> TryUpdateProgressAsync(
            int taskId,
            double progress,
            DateTime updatedAt,
            CancellationToken cancellationToken = default)
        {
            var updated = ToDbDateTime(updatedAt);
            return await _context.ProductionTasks
                .Where(t => t.Id == taskId && t.Status != JobStatus.Completed)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(t => t.Progress, progress)
                        .SetProperty(t => t.UpdatedAt, updated),
                    cancellationToken);
        }

        private DateTime ToDbDateTime(DateTime value) =>
            _context.Database.IsNpgsql() ? PostgresDateTime.ToUtc(value) : value;

        public void StageWorkInterval(WorkInterval interval) =>
            _context.WorkIntervals.Add(interval);

        public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
            _context.SaveChangesAsync(cancellationToken);
    }
}
