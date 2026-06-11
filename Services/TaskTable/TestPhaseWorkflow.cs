using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

/// <summary>Задача «через тест»: тест → согласование → основная часть (одиночная или дочерняя подзадача).</summary>
public static class TestPhaseWorkflow
{
    /// <summary>Одиночная задача или дочерняя подзадача общей задачи (не родитель split).</summary>
    public static bool IsTestPhaseTask(ProductionTask task) =>
        task.RequiresTestBeforeProduction
        && !(task.IsSplitTask && !task.ParentRowNumber.HasValue);

    public static bool IsActiveTestPhase(ProductionTask task) =>
        IsTestPhaseTask(task)
        && (task.WorkPhase == TaskWorkPhase.Test
            || task.WorkPhase == TaskWorkPhase.None);

    public static bool IsAwaitingProductionApproval(ProductionTask task) =>
        IsTestPhaseTask(task) && task.WorkPhase == TaskWorkPhase.AwaitingApproval;

    public static bool IsProductionPhase(ProductionTask task) =>
        IsTestPhaseTask(task) && task.WorkPhase == TaskWorkPhase.Production;

    public static double GetActiveEstimateHours(ProductionTask task)
    {
        if (!IsTestPhaseTask(task))
            return task.EstimateHours;

        return task.WorkPhase switch
        {
            TaskWorkPhase.Test => task.TestEstimateHours,
            TaskWorkPhase.Production => task.ProductionEstimateHours,
            _ => task.EstimateHours
        };
    }

    public static IReadOnlyList<WorkInterval> GetIntervalsForProgress(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals)
    {
        if (!IsProductionPhase(task) || !task.TestPhaseCompletedAt.HasValue)
            return intervals;

        var cutoff = task.TestPhaseCompletedAt.Value;
        return intervals
            .Where(i => i.StartTime >= cutoff)
            .ToList();
    }
}
