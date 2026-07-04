namespace ProductionPlanner.Services.TaskLists;

public interface ITaskListQueryService
{
    Task<List<object>> GetActiveTasksAsync(string employee, DateTime now, CancellationToken cancellationToken = default);
    Task<object> GetCompletedTasksAsync(
        string employee,
        int page,
        int pageSize,
        string statsPeriod,
        DateTime now,
        CancellationToken cancellationToken = default);
    Task<object> GetDailyWorkReportAsync(
        string employee,
        DateTime now,
        DateTime? reportDate = null,
        CancellationToken cancellationToken = default);
    Task<List<DeadlineRisk>> GetDeadlineRisksAsync(string employee, DateTime now, CancellationToken cancellationToken = default);
    Task<List<QueueOverloadAlert>> GetQueueOverloadsAsync(string employee, DateTime now, CancellationToken cancellationToken = default);
}
