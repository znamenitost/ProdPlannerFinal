using ProductionPlanner.Data;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

public static class SplitTaskStatusAggregator
{
    public static JobStatus ResolveParentStatus(IReadOnlyList<ProductionTask> children)
    {
        if (children.Count == 0)
            return JobStatus.Assigned;

        var activeChildren = children.Where(c => c.Status != JobStatus.Completed).ToList();
        if (activeChildren.Count == 1)
            return activeChildren[0].Status;

        if (children.All(c => c.Status == JobStatus.Completed))
            return JobStatus.Completed;

        if (children.Any(c => c.Status is JobStatus.Completed or JobStatus.InProgress or JobStatus.Paused))
            return JobStatus.InProgress;

        return JobStatus.Assigned;
    }

    public static TaskStatusPatch? BuildParentStatusPatch(
        JobStatus newStatus,
        IReadOnlyList<ProductionTask> children,
        DateTime now)
    {
        var activeChildren = children.Where(c => c.Status != JobStatus.Completed).ToList();
        var mirrorChild = activeChildren.Count == 1 ? activeChildren[0] : null;

        if (newStatus == JobStatus.Completed)
            return new TaskStatusPatch { Progress = 1, CompletedAt = mirrorChild?.CompletedAt ?? now };

        if (mirrorChild != null)
            return null;

        return new TaskStatusPatch { Progress = 0, ClearCompletedAt = true };
    }

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

        var activeChildren = children.Where(c => c.Status != JobStatus.Completed).ToList();
        if (activeChildren.Count == 1)
            statusText = TaskStatusMapper.ToText(activeChildren[0].Status);
        else if (children.Any(c => c.Status == JobStatus.PendingApproval))
            statusText = TaskStatusMapper.ToText(JobStatus.PendingApproval);
        else if (children.Any(c => c.Status == JobStatus.NoItems))
            statusText = "Нет изделий";
        else if (children.All(c => c.Status == JobStatus.Completed))
            statusText = "Готово";
        else if (children.Any(c => c.Status == JobStatus.Paused)
                 && children.All(c => c.Status is JobStatus.Paused or JobStatus.Assigned or JobStatus.Waiting))
            statusText = "Пауза";
        else if (children.Any(c =>
                     c.Status == JobStatus.Completed
                     || c.Status == JobStatus.InProgress
                     || c.Status == JobStatus.Paused))
            statusText = "Начал";
        else
            statusText = "Назначена";

        return (statusText, hasCurrentUserSubtask);
    }

    public static bool AggregatePriorityMarked(
        ProductionTask parent,
        IReadOnlyList<ProductionTask>? children)
    {
        if (parent.IsPriorityMarked)
            return true;

        if (!parent.IsSplitTask || children is not { Count: > 0 })
            return parent.IsPriorityMarked;

        return children.Any(c => c.IsPriorityMarked);
    }
}
