namespace ProductionPlanner.Services.TaskLists;

public interface ITaskListQueryService
{
    Task<List<object>> GetActiveTasksAsync(string employee, DateTime now);
    Task<object> GetCompletedTasksAsync(string employee);
    Task<List<DeadlineRisk>> GetDeadlineRisksAsync(string employee, DateTime now);
}
