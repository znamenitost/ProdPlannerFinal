namespace ProductionPlanner.Services.TaskTable;

public class TaskTableServiceResult<T>
{
    public T? Data { get; init; }
    public string? Error { get; init; }
    public bool NotFound { get; init; }

    public static TaskTableServiceResult<T> Ok(T data) => new() { Data = data };
    public static TaskTableServiceResult<T> Fail(string error) => new() { Error = error };
    public static TaskTableServiceResult<T> Missing() => new() { NotFound = true };
}
