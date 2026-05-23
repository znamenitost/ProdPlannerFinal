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

        if (children.Any(c => c.Status == JobStatus.PendingApproval))
            statusText = TaskStatusMapper.ToText(JobStatus.PendingApproval);
        else if (children.Any(c => c.Status == JobStatus.NoItems))
            statusText = "Нет изделий";
        else if (children.All(c => c.Status == JobStatus.Completed))
            statusText = "Готово";
        else if (children.Any(c =>
                     c.Status == JobStatus.Completed
                     || c.Status == JobStatus.InProgress
                     || c.Status == JobStatus.Paused
                     || c.Status == JobStatus.Approved
                     || c.Status == JobStatus.InStock))
            statusText = "Начал";
        else
            statusText = "Назначена";

        return (statusText, hasCurrentUserSubtask);
    }
}
