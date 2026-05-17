using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

public static class SplitTaskStatusAggregator
{
    public static (string StatusText, bool HasCurrentUserSubtask) Aggregate(
        ProductionTask parent,
        IReadOnlyList<ProductionTask>? children,
        string targetEmployeeName)
    {
        var statusText = TaskStatusMapper.ToText(parent.Status);
        var hasCurrentUserSubtask = false;

        if (!parent.IsSplitTask || children == null || children.Count == 0)
            return (statusText, hasCurrentUserSubtask);

        hasCurrentUserSubtask = children.Any(c =>
            c.EmployeeName == targetEmployeeName && c.Status != JobStatus.Completed);

        if (children.All(c => c.Status == JobStatus.Completed))
            statusText = "Готово";
        else if (children.Any(c =>
                     c.Status == JobStatus.Completed ||
                     c.Status == JobStatus.InProgress ||
                     c.Status == JobStatus.Paused))
            statusText = "Начал";
        else
            statusText = "";

        return (statusText, hasCurrentUserSubtask);
    }
}
