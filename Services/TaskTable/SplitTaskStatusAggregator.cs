using ProductionPlanner.Data;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

public static class SplitTaskStatusAggregator
{
    /// <summary>
    /// Вес статуса среди дочерних (слабее → сильнее). «Начал» — отдельное правило, не в списке.
    /// «Ожидание» только у дочерних; на родителе отображается как «Назначена».
    /// </summary>
    private static readonly JobStatus[] StatusWeightOrder =
    [
        JobStatus.Assigned,
        JobStatus.Waiting,
        JobStatus.Paused,
        JobStatus.Approved,
        JobStatus.PendingApproval,
        JobStatus.InStock,
        JobStatus.NoItems,
        JobStatus.Completed,
    ];

    private static readonly HashSet<JobStatus> InfoStatuses =
    [
        JobStatus.Approved,
        JobStatus.PendingApproval,
        JobStatus.InStock,
        JobStatus.NoItems,
    ];

    private static int GetWeight(JobStatus status)
    {
        for (var i = 0; i < StatusWeightOrder.Length; i++)
        {
            if (StatusWeightOrder[i] == status)
                return i;
        }

        return -1;
    }

    private static JobStatus StrongestByWeight(IEnumerable<JobStatus> statuses)
    {
        return statuses.OrderByDescending(GetWeight).First();
    }

    private static JobStatus? StrongestInfoStatus(IEnumerable<ProductionTask> children)
    {
        var infoStatuses = children
            .Select(c => c.Status)
            .Where(InfoStatuses.Contains)
            .ToList();

        if (infoStatuses.Count == 0)
            return null;

        return StrongestByWeight(infoStatuses);
    }

    /// <summary>Текст статуса родителя: «Ожидание» у ребёнка → «Назначена».</summary>
    private static string ToParentDisplayText(JobStatus status) =>
        status == JobStatus.Waiting
            ? TaskStatusMapper.ToText(JobStatus.Assigned)
            : TaskStatusMapper.ToText(status);

    /// <summary>Статус в БД: только workflow; инфо и «Ожидание» → Assigned.</summary>
    private static JobStatus ToParentDbStatus(JobStatus status) =>
        status is JobStatus.InProgress or JobStatus.Paused or JobStatus.Completed
            ? status
            : JobStatus.Assigned;

    /// <summary>
    /// Статус split-родителя для записи в БД.
    /// Инфостатусы на родителя не пишутся — только Assigned / InProgress / Paused / Completed.
    /// </summary>
    public static JobStatus ResolveParentStatus(IReadOnlyList<ProductionTask> children)
    {
        if (children.Count == 0)
            return JobStatus.Assigned;

        if (children.All(c => c.Status == JobStatus.Completed))
            return JobStatus.Completed;

        var activeChildren = children.Where(c => c.Status != JobStatus.Completed).ToList();

        if (activeChildren.Any(c => c.Status == JobStatus.InProgress))
            return JobStatus.InProgress;

        if (activeChildren.Count == 1)
            return ToParentDbStatus(activeChildren[0].Status);

        var strongest = StrongestByWeight(activeChildren.Select(c => c.Status));
        return ToParentDbStatus(strongest);
    }

    /// <summary>Текст статуса split-родителя для отображения (учитывает инфостатусы детей).</summary>
    public static string ResolveParentDisplayStatus(IReadOnlyList<ProductionTask> children)
    {
        if (children.Count == 0)
            return TaskStatusMapper.ToText(JobStatus.Assigned);

        if (children.All(c => c.Status == JobStatus.Completed))
            return TaskStatusMapper.ToText(JobStatus.Completed);

        var infoStatus = StrongestInfoStatus(children);
        if (infoStatus.HasValue)
            return ToParentDisplayText(infoStatus.Value);

        if (children.Any(c => c.Status == JobStatus.InProgress))
            return TaskStatusMapper.ToText(JobStatus.InProgress);

        var activeChildren = children.Where(c => c.Status != JobStatus.Completed).ToList();

        if (activeChildren.Count == 1)
            return ToParentDisplayText(activeChildren[0].Status);

        var strongest = StrongestByWeight(activeChildren.Select(c => c.Status));
        return ToParentDisplayText(strongest);
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

        statusText = ResolveParentDisplayStatus(children);

        return (statusText, hasCurrentUserSubtask);
    }

    public static bool AggregatePriorityMarked(
        ProductionTask parent,
        IReadOnlyList<ProductionTask>? children,
        string? viewerEmployeeName = null,
        bool restrictToViewer = false)
    {
        if (restrictToViewer && !string.IsNullOrWhiteSpace(viewerEmployeeName))
        {
            if (!parent.IsSplitTask || children is not { Count: > 0 })
            {
                return parent.IsPriorityMarked
                    && string.Equals(parent.EmployeeName, viewerEmployeeName, StringComparison.Ordinal);
            }

            return children.Any(c =>
                c.IsPriorityMarked
                && string.Equals(c.EmployeeName, viewerEmployeeName, StringComparison.Ordinal));
        }

        if (parent.IsPriorityMarked)
            return true;

        if (!parent.IsSplitTask || children is not { Count: > 0 })
            return parent.IsPriorityMarked;

        return children.Any(c => c.IsPriorityMarked);
    }
}
