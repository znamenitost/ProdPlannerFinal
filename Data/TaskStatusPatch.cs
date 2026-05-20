namespace ProductionPlanner.Data;

public sealed class TaskStatusPatch
{
    public double? Progress { get; init; }
    public DateTime? CompletedAt { get; init; }
    public bool ClearCompletedAt { get; init; }
    public double? ActualHours { get; init; }
}
