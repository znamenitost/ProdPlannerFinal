namespace ProductionPlanner.Services;

/// <summary>
/// Плановая очередь не укладывается в дедлайн (конец последнего слота позже дедлайна).
/// </summary>
public class QueueOverloadAlert
{
    public int TaskId { get; set; }
    public string TaskTitle { get; set; } = "";
    public string FileName { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public DateTime Deadline { get; set; }
    public DateTime PlannedEnd { get; set; }
    public string Message { get; set; } = "";
}
