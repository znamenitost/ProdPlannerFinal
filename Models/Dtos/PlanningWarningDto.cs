namespace ProductionPlanner.Models.Dtos;

/// <summary>
/// Предупреждение планирования для админа после сохранения задачи.
/// </summary>
public class PlanningWarningDto
{
    /// <summary>queueOverflow — не влезает в очередь; hoursShortfall — не хватает часов до дедлайна.</summary>
    public string Kind { get; set; } = "";

    public int TaskId { get; set; }
    public string TaskTitle { get; set; } = "";
    public string FileName { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public DateTime Deadline { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public double RequiredHours { get; set; }
    public double AvailableHours { get; set; }
    public string Message { get; set; } = "";
}
