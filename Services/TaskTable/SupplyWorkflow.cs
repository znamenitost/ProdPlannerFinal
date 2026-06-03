using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

/// <summary>Логика последовательного производства по этапам.</summary>
public static class SupplyWorkflow
{
    public static bool IsSequential(SupplyMode mode) => mode == SupplyMode.InternalProduction;

    public static JobStatus InitialChildStatus(SupplyMode mode, int sequenceOrder) =>
        IsSequential(mode) && sequenceOrder > 1
            ? JobStatus.Waiting
            : JobStatus.Assigned;

    public static bool IsSequenceBlocked(JobStatus status) => status == JobStatus.Waiting;

    public static bool CanTransitionWithOverride(
        JobStatus current,
        JobStatus target,
        bool sequenceOverride) =>
        sequenceOverride
        && current == JobStatus.Waiting
        && target == JobStatus.Assigned;

    /// <summary>
    /// После завершения этапа переводит следующий «Ожидание» в «Назначена».
    /// </summary>
    public static ProductionTask? FindNextWaitingChild(
        IReadOnlyList<(ProductionTask Child, int SequenceOrder)> orderedChildren)
    {
        return orderedChildren
            .OrderBy(x => x.SequenceOrder)
            .Select(x => x.Child)
            .FirstOrDefault(c => c.Status == JobStatus.Waiting);
    }

    /// <summary>
    /// Пересчитывает Waiting/Assigned после редактирования этапов.
    /// Первый незавершённый этап — Assigned, остальные незавершённые — Waiting.
    /// </summary>
    public static void ReconcileSequentialStatuses(
        IReadOnlyList<(ProductionTask Child, int SequenceOrder)> orderedChildren)
    {
        var sorted = orderedChildren
            .OrderBy(x => x.SequenceOrder)
            .Select(x => x.Child)
            .ToList();

        var activeAssigned = false;
        foreach (var child in sorted)
        {
            if (child.Status == JobStatus.Completed)
                continue;

            if (!activeAssigned)
            {
                if (child.Status == JobStatus.Waiting)
                    child.Status = JobStatus.Assigned;
                activeAssigned = true;
            }
            else if (child.Status == JobStatus.Assigned && !HasStarted(child))
            {
                child.Status = JobStatus.Waiting;
            }
        }
    }

    private static bool HasStarted(ProductionTask child) =>
        child.Status is JobStatus.InProgress or JobStatus.Paused or JobStatus.Completed
        || child.ActualHours > 0.01
        || child.Progress > 0.01
        || (child.WorkIntervals?.Count ?? 0) > 0;

    /// <summary>
    /// Только при смене режима родителя: активные этапы и интервалы не трогаем,
    /// очередь «Ожидание» выставляем лишь ещё не начатым этапам.
    /// </summary>
    public static void ApplySupplyModeChange(
        IReadOnlyList<(ProductionTask Child, int SequenceOrder)> orderedChildren,
        SupplyMode previousMode,
        SupplyMode newMode)
    {
        if (previousMode == newMode)
            return;

        if (IsSequential(newMode) && !IsSequential(previousMode))
            ApplySwitchToSequential(orderedChildren);
        else if (!IsSequential(newMode) && IsSequential(previousMode))
            ApplySwitchToParallel(orderedChildren);
    }

    private static void ApplySwitchToSequential(
        IReadOnlyList<(ProductionTask Child, int SequenceOrder)> orderedChildren)
    {
        var frontierOrder = orderedChildren
            .Where(x => HasStarted(x.Child))
            .Select(x => x.SequenceOrder)
            .DefaultIfEmpty(0)
            .Max();

        var sorted = orderedChildren.OrderBy(x => x.SequenceOrder).ToList();
        var firstIncomplete = sorted.FirstOrDefault(x => x.Child.Status != JobStatus.Completed);

        foreach (var (child, order) in sorted)
        {
            if (child.Status == JobStatus.Completed)
                continue;
            if (HasStarted(child))
                continue;
            if (TaskStatusMapper.IsEmployeeInfoStatus(child.Status)
                || child.Status is JobStatus.Approved or JobStatus.InStock)
                continue;

            if (frontierOrder == 0)
            {
                if (firstIncomplete != default && ReferenceEquals(child, firstIncomplete.Child))
                {
                    if (child.Status == JobStatus.Waiting)
                        child.Status = JobStatus.Assigned;
                    continue;
                }

                if (child.Status is JobStatus.Assigned or JobStatus.Waiting)
                    child.Status = JobStatus.Waiting;
                continue;
            }

            if (order > frontierOrder && child.Status is JobStatus.Assigned or JobStatus.Waiting)
                child.Status = JobStatus.Waiting;
        }
    }

    private static void ApplySwitchToParallel(
        IReadOnlyList<(ProductionTask Child, int SequenceOrder)> orderedChildren)
    {
        foreach (var (child, _) in orderedChildren)
        {
            if (child.Status != JobStatus.Waiting)
                continue;
            if (HasStarted(child))
                continue;
            if (TaskStatusMapper.IsEmployeeInfoStatus(child.Status)
                || child.Status is JobStatus.Approved or JobStatus.InStock)
                continue;

            child.Status = JobStatus.Assigned;
        }
    }
}
