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

    /// <summary>Маркер «через согласование» для строки таблицы (родитель split — по детям).</summary>
    public static bool TaskShowsThroughApproval(
        ProductionTask task,
        IReadOnlyList<ProductionTask>? children = null)
    {
        if (task.Status == JobStatus.Completed) return false;

        if (task.IsSplitTask && !task.ParentRowNumber.HasValue)
        {
            if (children is not { Count: > 0 }) return false;
            return children.Any(c => TaskShowsThroughApproval(c));
        }

        return IsActiveTestPhase(task);
    }

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

    /// <summary>Интервалы для расчёта saved hours при завершении production-фазы.</summary>
    public static IReadOnlyList<WorkInterval> GetIntervalsForCompletion(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals) =>
        GetIntervalsForProgress(task, intervals);

    /// <summary>
    /// Saved hours с учётом фаз «через тест»: тестовые и production-часы считаются отдельно.
    /// </summary>
    public static double ComputeSavedHours(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals,
        Func<DateTime, DateTime, double> workHoursBetween)
    {
        if (!IsTestPhaseTask(task))
            return task.EstimateHours - SumClosedWorkHours(intervals, workHoursBetween);

        if (!task.TestPhaseCompletedAt.HasValue)
            return task.TestEstimateHours - SumClosedWorkHours(intervals, workHoursBetween);

        var cutoff = task.TestPhaseCompletedAt.Value;
        var testIntervals = intervals.Where(i => i.StartTime < cutoff).ToList();
        var productionIntervals = intervals.Where(i => i.StartTime >= cutoff).ToList();
        var testSaved = task.TestEstimateHours - SumClosedWorkHours(testIntervals, workHoursBetween);
        var productionSaved = task.ProductionEstimateHours
            - SumClosedWorkHours(productionIntervals, workHoursBetween);
        return testSaved + productionSaved;
    }

    public static double SumClosedWorkHours(
        IReadOnlyList<WorkInterval> intervals,
        Func<DateTime, DateTime, double> workHoursBetween) =>
        intervals
            .Where(i => i.EndTime.HasValue)
            .Sum(i => workHoursBetween(i.StartTime, i.EndTime!.Value));

    /// <summary>Интервалы для пересчёта ActualHours при завершении (все закрытые).</summary>
    public static double SumAllClosedWorkHours(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals,
        Func<DateTime, DateTime, double> workHoursBetween)
    {
        var relevant = IsProductionPhase(task) && task.TestPhaseCompletedAt.HasValue
            ? GetIntervalsForCompletion(task, intervals)
            : intervals;
        return SumClosedWorkHours(relevant, workHoursBetween);
    }
}
