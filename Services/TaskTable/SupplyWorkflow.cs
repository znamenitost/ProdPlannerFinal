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
        child.Status is JobStatus.InProgress or JobStatus.Paused
        || child.ActualHours > 0.01
        || child.Progress > 0.01;
}
