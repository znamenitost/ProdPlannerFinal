using System.Collections.Concurrent;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ProductionPlanner.Services
{
    public class TaskSplitService : ITaskSplitService
    {
        private static readonly ConcurrentDictionary<int, SemaphoreSlim> SplitLocks = new();

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

        public async Task<ProductionTask> SplitTaskAsync(
            int parentTaskId,
            List<SplitPart> parts,
            SupplyMode? supplyMode = null,
            CancellationToken cancellationToken = default)
        {
            ProductionTask? result = null;
            await RunWithParentSplitLockAsync(parentTaskId, async ct =>
            {
                result = await SplitTaskCoreAsync(parentTaskId, parts, supplyMode, ct);
            }, cancellationToken);
            return result!;
        }

        private async Task<ProductionTask> SplitTaskCoreAsync(
            int parentTaskId,
            List<SplitPart> parts,
            SupplyMode? supplyMode,
            CancellationToken cancellationToken)
        {
            var parentTask = await LoadParentForMutationAsync(parentTaskId, cancellationToken);
            if (parentTask.IsSplitTask)
                throw new InvalidOperationException("Задача уже разделена между сотрудниками");

            var parentWithWork = await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == parentTaskId, cancellationToken)
                ?? parentTask;

            var parentHasWorkHistory = HasWorkHistory(parentWithWork);
            var workMigratedToChild = false;

            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            parentTask.EstimateHours = totalAllocated;
            parentTask.Type = string.Join(", ",
                parts.Select(p => p.TaskType).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct());
            parentTask.SupplyMode = NormalizeSplitSupplyMode(supplyMode ?? parentTask.SupplyMode);

            foreach (var (part, index) in parts.Select((p, i) => (p, i)))
            {
                ValidateTestPart(part);
                var sequenceOrder = part.SequenceOrder > 0 ? part.SequenceOrder : index + 1;

                var migrateParentWork = parentHasWorkHistory
                    && !workMigratedToChild
                    && ShouldMigratePartFromParent(parentWithWork, part, parts);

                var childTask = CreateChildFromPart(parentTask, part, sequenceOrder);
                if (migrateParentWork)
                {
                    CopyWorkStateFromParent(childTask, parentWithWork);
                    workMigratedToChild = true;
                }

                await _repo.AddTaskAsync(childTask, cancellationToken);

                if (migrateParentWork)
                    await MigrateIntervalsToChildAsync(parentWithWork, childTask.Id, cancellationToken);

                var split = new TaskSplit
                {
                    ParentRowNumber = parentTask.Id,
                    ChildTaskId = childTask.Id,
                    AssignedTo = part.EmployeeName,
                    SplitType = part.TaskType,
                    AllocatedHours = part.AllocatedHours,
                    SequenceOrder = sequenceOrder
                };

                await _context.TaskSplits.AddAsync(split);

                await _notificationService.NotifyNewTaskAsync(childTask);
            }

            if (workMigratedToChild)
                ClearParentWorkState(parentTask);

            parentTask.IsSplitTask = true;
            parentTask.EmployeeName = "";
            parentTask.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(parentTask, cancellationToken);

            await RecalculateParentStatusAsync(parentTask.Id, cancellationToken);

            return parentTask;
        }

        public async Task<ProductionTask> UpdateSplitAsync(
            int parentTaskId,
            List<SplitPart> parts,
            SupplyMode? supplyMode = null,
            CancellationToken cancellationToken = default)
        {
            ProductionTask? result = null;
            await RunWithParentSplitLockAsync(parentTaskId, async ct =>
            {
                result = await UpdateSplitCoreAsync(parentTaskId, parts, supplyMode, ct);
            }, cancellationToken);
            return result!;
        }

        private async Task<ProductionTask> UpdateSplitCoreAsync(
            int parentTaskId,
            List<SplitPart> parts,
            SupplyMode? supplyMode,
            CancellationToken cancellationToken)
        {
            var parentTask = await LoadParentForMutationAsync(parentTaskId, cancellationToken);
            if (parentTask.ParentRowNumber != null)
                throw new Exception("Нельзя редактировать назначения у подзадачи");

            if (parts.Count == 0)
                throw new Exception("Укажите сотрудника");

            if (parts.Count == 1)
            {
                if (!parentTask.IsSplitTask)
                    return await UpdateRegularTaskAssignmentsAsync(parentTask, parts[0], cancellationToken);

                return await ConvertToRegularTaskAsync(parentTask, parts[0], cancellationToken);
            }

            if (!parentTask.IsSplitTask)
                return await SplitTaskCoreAsync(parentTaskId, parts, supplyMode, cancellationToken);

            var existingChildren = await GetChildTasksAsync(parentTaskId, cancellationToken);
            var splits = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == parentTaskId)
                .ToListAsync(cancellationToken);
            var usedChildIds = new HashSet<int>();
            var now = _timeService.Now;
            var previousSupplyMode = parentTask.SupplyMode;

            var totalAllocated = parts.Sum(p => p.AllocatedHours);
            parentTask.EstimateHours = totalAllocated;
            parentTask.Type = string.Join(", ",
                parts.Select(p => p.TaskType).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct());
            parentTask.EmployeeName = "";
            parentTask.SupplyMode = NormalizeSplitSupplyMode(supplyMode ?? parentTask.SupplyMode);
            parentTask.UpdatedAt = now;

            foreach (var (part, index) in parts.Select((p, i) => (p, i)))
            {
                ValidateTestPart(part);
                var sequenceOrder = part.SequenceOrder > 0 ? part.SequenceOrder : index + 1;
                var child = ResolveChildForPart(part, existingChildren, usedChildIds);

                if (child != null)
                {
                    usedChildIds.Add(child.Id);
                    var preserved = CaptureWorkState(child);
                    ApplyPartToChild(child, parentTask, part);
                    RestoreWorkState(child, preserved);
                    await _repo.UpdateTaskAsync(child, cancellationToken);

                    var splitRecord = splits.FirstOrDefault(s => s.ChildTaskId == child.Id);
                    if (splitRecord != null)
                    {
                        splitRecord.AssignedTo = part.EmployeeName;
                        splitRecord.SplitType = part.TaskType;
                        splitRecord.AllocatedHours = part.AllocatedHours;
                        splitRecord.SequenceOrder = sequenceOrder;
                    }
                }
                else
                {
                    var newChild = CreateChildFromPart(parentTask, part, sequenceOrder);
                    await _repo.AddTaskAsync(newChild);
                    usedChildIds.Add(newChild.Id);

                    await _context.TaskSplits.AddAsync(new TaskSplit
                    {
                        ParentRowNumber = parentTask.Id,
                        ChildTaskId = newChild.Id,
                        AssignedTo = part.EmployeeName,
                        SplitType = part.TaskType,
                        AllocatedHours = part.AllocatedHours,
                        SequenceOrder = sequenceOrder
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
                    await lifecycle.CompleteTaskAsync(orphan.Id, now, cancellationToken);
                    var orphanSplits = splits.Where(s => s.ChildTaskId == orphan.Id).ToList();
                    if (orphanSplits.Any())
                        _context.TaskSplits.RemoveRange(orphanSplits);
                }
            }

            await _repo.UpdateTaskAsync(parentTask, cancellationToken);

            await ApplySupplyModeChangeIfNeededAsync(
                parentTaskId,
                previousSupplyMode,
                parentTask.SupplyMode,
                cancellationToken);

            return parentTask;
        }

        private async Task ApplySupplyModeChangeIfNeededAsync(
            int parentTaskId,
            SupplyMode previousMode,
            SupplyMode newMode,
            CancellationToken cancellationToken)
        {
            var previous = NormalizeSplitSupplyMode(previousMode);
            var next = NormalizeSplitSupplyMode(newMode);
            if (previous == next)
                return;

            var ordered = await GetOrderedChildrenForSupplyModeAsync(parentTaskId, cancellationToken);
            if (ordered.Count == 0)
                return;

            SupplyWorkflow.ApplySupplyModeChange(ordered, previous, next);

            foreach (var (child, _) in ordered)
                await _repo.UpdateTaskAsync(child, cancellationToken);
        }

        private async Task<List<(ProductionTask Child, int SequenceOrder)>> GetOrderedChildrenForSupplyModeAsync(
            int parentTaskId,
            CancellationToken cancellationToken)
        {
            var splits = await _context.TaskSplits
                .AsNoTracking()
                .Where(ts => ts.ParentRowNumber == parentTaskId)
                .ToListAsync(cancellationToken);
            if (splits.Count == 0)
                return [];

            var orderById = splits.ToDictionary(s => s.ChildTaskId, s => s.SequenceOrder);
            var children = await GetChildTasksAsync(parentTaskId, cancellationToken);
            return children
                .Select(c => (c, orderById.GetValueOrDefault(c.Id, 0)))
                .ToList();
        }

        /// <summary>
        /// Редактирование одиночной задачи: только часы, тип и исполнитель — статус и история работы не трогаются.
        /// </summary>
        private async Task<ProductionTask> UpdateRegularTaskAssignmentsAsync(
            ProductionTask parent,
            SplitPart part,
            CancellationToken cancellationToken)
        {
            parent.Type = part.TaskType ?? string.Empty;
            parent.EmployeeName = part.EmployeeName;
            parent.UpdatedAt = _timeService.Now;

            if (part.RequiresTestBeforeProduction)
            {
                parent.RequiresTestBeforeProduction = true;
                parent.TestEstimateHours = part.TestEstimateHours;
                parent.ProductionEstimateHours = part.ProductionEstimateHours;
                parent.EstimateHours = part.TestEstimateHours + part.ProductionEstimateHours;
                if (parent.WorkPhase == TaskWorkPhase.None)
                    parent.WorkPhase = TaskWorkPhase.Test;
            }
            else
            {
                parent.RequiresTestBeforeProduction = false;
                parent.TestEstimateHours = 0;
                parent.ProductionEstimateHours = 0;
                parent.WorkPhase = TaskWorkPhase.None;
                parent.EstimateHours = part.AllocatedHours;
            }

            await _repo.UpdateTaskAsync(parent, cancellationToken);
            return parent;
        }

        private static SupplyMode NormalizeSplitSupplyMode(SupplyMode? supplyMode) =>
            supplyMode == SupplyMode.InternalProduction
                ? SupplyMode.InternalProduction
                : SupplyMode.Cooperative;

        private async Task RunWithParentSplitLockAsync(
            int parentTaskId,
            Func<CancellationToken, Task> action,
            CancellationToken cancellationToken)
        {
            var sem = SplitLocks.GetOrAdd(parentTaskId, _ => new SemaphoreSlim(1, 1));
            await sem.WaitAsync(cancellationToken);
            try
            {
                await _repo.ExecuteInTransactionAsync(action, cancellationToken);
            }
            finally
            {
                sem.Release();
                if (sem.CurrentCount == 1
                    && SplitLocks.TryRemove(new KeyValuePair<int, SemaphoreSlim>(parentTaskId, sem)))
                {
                    sem.Dispose();
                }
            }
        }

        /// <summary>
        /// Returns a tracked parent when it is already in the change tracker (e.g. just created via AddTaskAsync).
        /// </summary>
        private async Task<ProductionTask?> TryLoadParentForMutationAsync(
            int parentTaskId,
            CancellationToken cancellationToken)
        {
            var tracked = _context.ProductionTasks.Local.FirstOrDefault(t => t.Id == parentTaskId);
            if (tracked != null)
                return tracked;

            return await _context.ProductionTasks
                .FirstOrDefaultAsync(t => t.Id == parentTaskId, cancellationToken);
        }

        private async Task<ProductionTask> LoadParentForMutationAsync(
            int parentTaskId,
            CancellationToken cancellationToken)
        {
            var parent = await TryLoadParentForMutationAsync(parentTaskId, cancellationToken);
            if (parent == null)
                throw new Exception($"Задача {parentTaskId} не найдена");
            return parent;
        }

        private static void ValidateTestPart(SplitPart part)
        {
            if (!part.RequiresTestBeforeProduction)
                return;

            if (part.TestEstimateHours < 0.5 || part.ProductionEstimateHours < 0.5)
                throw new InvalidOperationException("Укажите часы теста и основной части (от 0.5).");

            var expected = part.TestEstimateHours + part.ProductionEstimateHours;
            if (Math.Abs(part.AllocatedHours - expected) > 0.01)
                throw new InvalidOperationException(
                    $"Сумма часов теста и основной части ({expected}) должна совпадать с выделенным временем ({part.AllocatedHours}).");
        }

        private static ProductionTask CreateChildFromPart(ProductionTask parent, SplitPart part, int sequenceOrder)
        {
            var child = new ProductionTask
            {
                DisplayOrder = -1,
                FolderPath = parent.FolderPath,
                FileName = $"{parent.FileName} [{part.TaskType}]",
                Comment = "",
                Deadline = parent.Deadline,
                EstimateHours = part.AllocatedHours,
                Type = part.TaskType,
                EmployeeName = part.EmployeeName,
                Status = SupplyWorkflow.InitialChildStatus(parent.SupplyMode, sequenceOrder),
                Progress = 0,
                ActualHours = 0,
                ParentRowNumber = parent.Id,
                IsSplitTask = true,
                WorkIntervals = new List<WorkInterval>()
            };
            ApplyTestPhaseFromPart(child, part, isNewChild: true);
            return child;
        }

        private void ApplyPartToChild(ProductionTask child, ProductionTask parent, SplitPart part)
        {
            ApplyTestPhaseFromPart(child, part, isNewChild: false);
            child.Type = part.TaskType;
            child.EmployeeName = part.EmployeeName;
            child.Deadline = parent.Deadline;
            child.FolderPath = parent.FolderPath;
            child.FileName = $"{parent.FileName} [{part.TaskType}]";
            child.UpdatedAt = _timeService.Now;
        }

        private static void ApplyTestPhaseFromPart(ProductionTask task, SplitPart part, bool isNewChild)
        {
            if (!part.RequiresTestBeforeProduction)
            {
                if (isNewChild || task.WorkPhase == TaskWorkPhase.None)
                {
                    task.RequiresTestBeforeProduction = false;
                    task.TestEstimateHours = 0;
                    task.ProductionEstimateHours = 0;
                    task.WorkPhase = TaskWorkPhase.None;
                    task.TestPhaseCompletedAt = null;
                }

                task.EstimateHours = part.AllocatedHours;
                return;
            }

            task.RequiresTestBeforeProduction = true;
            task.TestEstimateHours = part.TestEstimateHours;
            task.ProductionEstimateHours = part.ProductionEstimateHours;
            task.EstimateHours = part.TestEstimateHours + part.ProductionEstimateHours;

            if (isNewChild
                || (task.WorkPhase == TaskWorkPhase.None
                    && task.Status is JobStatus.Assigned or JobStatus.Approved or JobStatus.InStock))
            {
                task.WorkPhase = TaskWorkPhase.Test;
            }
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
            (child.Status == JobStatus.Assigned || child.Status == JobStatus.Waiting)
            && child.ActualHours < 0.01
            && child.Progress < 0.01;

        private static bool HasWorkHistory(ProductionTask task) =>
            (task.WorkIntervals?.Count ?? 0) > 0
            || task.Status is JobStatus.InProgress or JobStatus.Paused or JobStatus.Completed;

        private static bool ShouldMigratePartFromParent(
            ProductionTask parent,
            SplitPart part,
            List<SplitPart> parts)
        {
            if (!string.IsNullOrEmpty(parent.EmployeeName)
                && string.Equals(part.EmployeeName, parent.EmployeeName, StringComparison.Ordinal))
                return true;

            return string.IsNullOrEmpty(parent.EmployeeName) && parts.IndexOf(part) == 0;
        }

        private static void CopyWorkStateFromParent(ProductionTask child, ProductionTask parent)
        {
            child.Status = parent.Status;
            child.Progress = parent.Progress;
            child.ActualHours = parent.ActualHours;
            child.CompletedAt = parent.CompletedAt;
        }

        private static void ClearParentWorkState(ProductionTask parent)
        {
            parent.Status = JobStatus.Assigned;
            parent.Progress = 0;
            parent.ActualHours = 0;
            parent.CompletedAt = null;
        }

        private async Task MigrateIntervalsToChildAsync(
            ProductionTask parent,
            int childTaskId,
            CancellationToken cancellationToken)
        {
            foreach (var interval in parent.WorkIntervals.ToList())
            {
                interval.ProductionTaskId = childTaskId;
                await _repo.UpdateWorkIntervalAsync(interval, cancellationToken);
            }

            parent.WorkIntervals.Clear();
        }

        private readonly record struct ChildWorkState(
            JobStatus Status,
            double Progress,
            double ActualHours,
            DateTime? CompletedAt);

        private static ChildWorkState CaptureWorkState(ProductionTask child) =>
            new(child.Status, child.Progress, child.ActualHours, child.CompletedAt);

        private static void RestoreWorkState(ProductionTask child, ChildWorkState state)
        {
            child.Status = state.Status;
            child.Progress = state.Progress;
            child.ActualHours = state.ActualHours;
            child.CompletedAt = state.CompletedAt;
        }

        private async Task<ProductionTask> ConvertToRegularTaskAsync(
            ProductionTask parent,
            SplitPart part,
            CancellationToken cancellationToken)
        {
            var now = _timeService.Now;
            var activeChildren = await GetChildTasksAsync(parent.Id, cancellationToken);
            var allChildren = await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == parent.Id)
                .ToListAsync(cancellationToken);
            var splits = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == parent.Id)
                .ToListAsync(cancellationToken);
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
                    await lifecycle.CompleteTaskAsync(child.Id, now, cancellationToken);
                }
            }

            parent.EmployeeName = part.EmployeeName;
            parent.EstimateHours = part.AllocatedHours;
            parent.Type = part.TaskType ?? string.Empty;
            parent.IsSplitTask = false;
            parent.SupplyMode = SupplyMode.None;
            parent.FileName = ResolveBaseFileName(parent.FileName, keptChild);
            parent.UpdatedAt = now;

            if (keptChild != null)
            {
                parent.Status = keptChild.Status;
                parent.Progress = keptChild.Progress;
                parent.ActualHours = keptChild.ActualHours;
                parent.CompletedAt = keptChild.CompletedAt;
                parent.RequiresTestBeforeProduction = keptChild.RequiresTestBeforeProduction;
                parent.TestEstimateHours = keptChild.TestEstimateHours;
                parent.ProductionEstimateHours = keptChild.ProductionEstimateHours;
                parent.WorkPhase = keptChild.WorkPhase;
                parent.TestPhaseCompletedAt = keptChild.TestPhaseCompletedAt;

                foreach (var interval in keptChild.WorkIntervals.ToList())
                {
                    interval.ProductionTaskId = parent.Id;
                    await _repo.UpdateWorkIntervalAsync(interval, cancellationToken);
                }

                _context.ProductionTasks.Remove(keptChild);
            }
            else
            {
                var parentWithWork = await _context.ProductionTasks
                    .Include(t => t.WorkIntervals)
                    .FirstOrDefaultAsync(t => t.Id == parent.Id, cancellationToken)
                    ?? parent;

                if (!HasWorkHistory(parentWithWork))
                {
                    parent.Status = JobStatus.Assigned;
                    parent.Progress = 0;
                    parent.ActualHours = 0;
                    parent.CompletedAt = null;
                }
            }

            if (splits.Any())
                _context.TaskSplits.RemoveRange(splits);

            await _repo.UpdateTaskAsync(parent, cancellationToken);

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

        private async Task RecalculateParentStatusAsync(int parentId, CancellationToken cancellationToken)
        {
            var parent = await TryLoadParentForMutationAsync(parentId, cancellationToken);
            if (parent == null || !parent.IsSplitTask) return;

            var children = await GetChildTasksAsync(parentId, cancellationToken);
            if (!children.Any()) return;

            JobStatus newStatus;
            if (children.All(c => c.Status == JobStatus.Completed))
                newStatus = JobStatus.Completed;
            else if (children.Any(c =>
                c.Status is JobStatus.Completed or JobStatus.InProgress or JobStatus.Paused))
                newStatus = JobStatus.InProgress;
            else
                newStatus = JobStatus.Assigned;

            var now = _timeService.Now;
            var patch = newStatus == JobStatus.Completed
                ? new TaskStatusPatch { Progress = 1, CompletedAt = now }
                : new TaskStatusPatch { Progress = 0, ClearCompletedAt = true };

            if (parent.Status == newStatus)
            {
                if (newStatus == JobStatus.Completed && parent.Progress < 0.99)
                {
                    await _repo.TryTransitionStatusAsync(
                        parent.Id,
                        JobStatus.Completed,
                        now,
                        expectedStatuses: null,
                        patch,
                        cancellationToken);
                }

                return;
            }

            await _repo.TryTransitionStatusAsync(
                parent.Id,
                newStatus,
                now,
                expectedStatuses: null,
                patch,
                cancellationToken);
        }

        public async Task<bool> AreAllSubtasksCompletedAsync(
            int parentRowNumber,
            CancellationToken cancellationToken = default)
        {
            var children = await GetChildTasksAsync(parentRowNumber, cancellationToken);
            if (children.Count == 0) return true;
            return children.All(t => t.Status == JobStatus.Completed);
        }

        public async Task UpdateParentCompletionStatusAsync(
            int parentRowNumber,
            CancellationToken cancellationToken = default)
        {
            await AreAllSubtasksCompletedAsync(parentRowNumber, cancellationToken);
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(
            int parentRowNumber,
            CancellationToken cancellationToken = default)
        {
            var splits = await _context.TaskSplits
                .AsNoTracking()
                .Where(ts => ts.ParentRowNumber == parentRowNumber)
                .OrderBy(ts => ts.SequenceOrder)
                .ThenBy(ts => ts.Id)
                .ToListAsync(cancellationToken);

            if (splits.Count == 0)
                return [];

            var childIds = splits.Select(s => s.ChildTaskId).ToList();
            var children = await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => childIds.Contains(t.Id))
                .ToListAsync(cancellationToken);

            var orderById = splits
                .Select((s, i) => new { s.ChildTaskId, Index = i })
                .ToDictionary(x => x.ChildTaskId, x => x.Index);

            return children
                .OrderBy(c => orderById.GetValueOrDefault(c.Id, int.MaxValue))
                .ToList();
        }

        public async Task AdvanceSequentialStageAsync(
            int parentTaskId,
            CancellationToken cancellationToken = default)
        {
            var parent = await _repo.GetTaskByIdAsync(parentTaskId, cancellationToken);
            if (parent == null || !SupplyWorkflow.IsSequential(parent.SupplyMode))
                return;

            var ordered = await GetOrderedChildrenWithSequenceAsync(parentTaskId, cancellationToken);
            var next = SupplyWorkflow.FindNextWaitingChild(ordered);
            if (next == null)
                return;

            next.Status = JobStatus.Assigned;
            next.UpdatedAt = _timeService.Now;
            await _repo.UpdateTaskAsync(next, cancellationToken);
            var stageNumber = ordered.FirstOrDefault(x => x.Child.Id == next.Id).SequenceOrder;
            await _notificationService.NotifySequentialStageReadyAsync(next, stageNumber);
        }

        private async Task<List<(ProductionTask Child, int SequenceOrder)>> GetOrderedChildrenWithSequenceAsync(
            int parentTaskId,
            CancellationToken cancellationToken)
        {
            var splits = await _context.TaskSplits
                .Where(ts => ts.ParentRowNumber == parentTaskId)
                .OrderBy(ts => ts.SequenceOrder)
                .ThenBy(ts => ts.Id)
                .ToListAsync(cancellationToken);

            if (splits.Count == 0)
                return [];

            var childIds = splits.Select(s => s.ChildTaskId).ToList();
            var children = await _context.ProductionTasks
                .Where(t => childIds.Contains(t.Id))
                .ToListAsync(cancellationToken);

            var childById = children.ToDictionary(c => c.Id);
            return splits
                .Where(s => childById.ContainsKey(s.ChildTaskId))
                .Select(s => (childById[s.ChildTaskId], s.SequenceOrder))
                .ToList();
        }
    }
}
