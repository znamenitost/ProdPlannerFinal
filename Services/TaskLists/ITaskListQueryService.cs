namespace ProductionPlanner.Services.TaskLists;

public interface ITaskListQueryService
{
    Task<List<object>> GetActiveTasksAsync(string employee, DateTime now, CancellationToken cancellationToken = default);
    Task<object> GetCompletedTasksAsync(string employee, CancellationToken cancellationToken = default);
    Task<List<DeadlineRisk>> GetDeadlineRisksAsync(string employee, DateTime now, CancellationToken cancellationToken = default);
}
