using ProductionPlanner.Models;

namespace ProductionPlanner.Data
{
    public interface IProductionTaskRepository
    {
        Task<List<ProductionTask>> GetActiveTasksAsync(string employeeName, CancellationToken cancellationToken = default);
        Task<CompletedTasksAggregateStats> GetCompletedTasksStatsAsync(string employeeName, CancellationToken cancellationToken = default);
        Task<PaginatedResult<ProductionTask>> GetCompletedTasksPaginatedAsync(
            string employeeName,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);
        Task<List<WorkInterval>> GetWorkIntervalsForTaskIdsAsync(
            IReadOnlyList<int> taskIds,
            CancellationToken cancellationToken = default);
        Task<List<ProductionTask>> GetEmployeeTasksForCalendarWeekAsync(
            string employeeName,
            DateTime weekStart,
            DateTime weekEnd,
            CancellationToken cancellationToken = default);
        Task AppendRootDisplayOrderAsync(int rootTaskId, CancellationToken cancellationToken = default);
        Task<ProductionTask?> GetTaskByIdAsync(
            int id,
            CancellationToken cancellationToken = default,
            bool includeIntervals = false);
        Task<ProductionTask?> GetTaskByRowNumberAsync(
            int rowNumber,
            CancellationToken cancellationToken = default,
            bool includeIntervals = false);
        Task AddTaskAsync(ProductionTask task, CancellationToken cancellationToken = default);
        Task UpdateTaskAsync(ProductionTask task, CancellationToken cancellationToken = default);
        Task DeleteTaskAsync(int id, CancellationToken cancellationToken = default);
        Task DetachTasksFromSplitAsync(IReadOnlyList<int> childTaskIds, CancellationToken cancellationToken = default);
        Task DeleteAllTasksAsync(CancellationToken cancellationToken = default);
        Task AddWorkIntervalAsync(WorkInterval interval, CancellationToken cancellationToken = default);
        Task UpdateWorkIntervalAsync(WorkInterval interval, CancellationToken cancellationToken = default);
        Task DeleteWorkIntervalAsync(WorkInterval interval, CancellationToken cancellationToken = default);
        Task DeleteAllWorkIntervalsAsync(CancellationToken cancellationToken = default);
        Task<EmployeeStat?> GetEmployeeStatAsync(string employeeName, CancellationToken cancellationToken = default);
        Task UpdateEmployeeStatAsync(EmployeeStat stat, CancellationToken cancellationToken = default);
        Task<List<ProductionTask>> GetChildTasksAsync(int parentId, CancellationToken cancellationToken = default);
        Task<List<TaskSplit>> GetTaskSplitsByParentIdAsync(int parentId, CancellationToken cancellationToken = default);
        Task<Dictionary<int, (SupplyMode SupplyMode, int SequenceOrder)>> GetTaskSplitMetadataByChildTaskIdsAsync(
            IReadOnlyList<int> childTaskIds,
            CancellationToken cancellationToken = default);
        Task<PaginatedResult<ProductionTask>> GetRootTasksPaginatedAsync(int page, int pageSize, CancellationToken cancellationToken = default);
        Task<Dictionary<int, List<ProductionTask>>> GetSplitChildrenByParentIdsAsync(IReadOnlyList<int> parentIds, CancellationToken cancellationToken = default);
        Task ReorderTasksAsync(List<int> orderedIds, CancellationToken cancellationToken = default);
        Task<List<WorkInterval>> GetWorkIntervalsForDateRangeAsync(string employeeName, DateTime start, DateTime end, CancellationToken cancellationToken = default);
        Task ExecuteInTransactionAsync(Func<CancellationToken, Task> action, CancellationToken cancellationToken = default);
        Task ExecuteWithTaskLifecycleLockAsync(int taskId, Func<CancellationToken, Task> action, CancellationToken cancellationToken = default);
        Task<int> CloseOpenIntervalsAsync(int taskId, DateTime closedAt, CancellationToken cancellationToken = default);
        Task<int> TryTransitionStatusAsync(
            int taskId,
            JobStatus newStatus,
            DateTime updatedAt,
            IReadOnlyList<JobStatus>? expectedStatuses = null,
            TaskStatusPatch? patch = null,
            CancellationToken cancellationToken = default);
        void StageWorkInterval(WorkInterval interval);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
