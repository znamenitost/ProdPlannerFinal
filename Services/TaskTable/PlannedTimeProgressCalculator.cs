using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Services.TaskTable;

/// <summary>
/// Плановый % выполнения по времени: отработанные рабочие часы / выделенные часы после старта.
/// </summary>
public static class PlannedTimeProgressCalculator
{
    private static readonly WorkHoursCalculator WorkHours = new();

    public static double GetPercent(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals,
        DateTime now,
        double? estimateHoursOverride = null)
    {
        var estimateHours = estimateHoursOverride ?? task.EstimateHours;
        if (estimateHours <= 0)
            return 0;

        if (task.Status == JobStatus.Completed)
            return 100;

        if (!HasWorkStarted(task.Status, intervals))
            return 0;

        var elapsedHours = GetElapsedWorkHours(intervals, now);
        var percent = elapsedHours / estimateHours * 100;
        return Math.Clamp(Math.Round(percent), 0, 100);
    }

    public static bool ShouldShow(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals,
        double? estimateHoursOverride = null)
    {
        var estimateHours = estimateHoursOverride ?? task.EstimateHours;
        if (task.Status == JobStatus.Completed)
            return false;

        return estimateHours > 0 && HasWorkStarted(task.Status, intervals);
    }

    /// <summary>
    /// Плановый % для split-родителя: сумма отработанных часов детей / сумма выделенных часов детей.
    /// </summary>
    public static double GetSplitParentPercent(
        IReadOnlyList<ProductionTask> children,
        IReadOnlyDictionary<int, IReadOnlyList<WorkInterval>> intervalsByChildId,
        DateTime now)
    {
        if (children.Count == 0)
            return 0;

        var totalEstimate = children.Sum(TestPhaseWorkflow.GetActiveEstimateHours);
        if (totalEstimate <= 0)
            return 0;

        if (children.All(c => c.Status == JobStatus.Completed))
            return 100;

        double totalElapsed = 0;
        foreach (var child in children)
        {
            intervalsByChildId.TryGetValue(child.Id, out var intervals);
            intervals ??= Array.Empty<WorkInterval>();
            var progressIntervals = TestPhaseWorkflow.GetIntervalsForProgress(child, intervals.ToList());
            totalElapsed += GetElapsedWorkHours(progressIntervals, now);
        }

        var percent = totalElapsed / totalEstimate * 100;
        return Math.Clamp(Math.Round(percent), 0, 100);
    }

    public static bool ShouldShowSplitParent(
        IReadOnlyList<ProductionTask> children,
        IReadOnlyDictionary<int, IReadOnlyList<WorkInterval>> intervalsByChildId,
        string statusText)
    {
        if (children.Count == 0)
            return false;

        if (children.All(c => c.Status == JobStatus.Completed))
            return false;

        var totalEstimate = children.Sum(TestPhaseWorkflow.GetActiveEstimateHours);
        if (totalEstimate <= 0)
            return false;

        if (statusText is "Начал" or "Пауза")
            return true;

        return children.Any(child =>
        {
            intervalsByChildId.TryGetValue(child.Id, out var intervals);
            intervals ??= Array.Empty<WorkInterval>();
            return HasWorkStarted(child.Status, intervals);
        });
    }

    private static bool HasWorkStarted(JobStatus status, IReadOnlyList<WorkInterval> intervals)
    {
        if (intervals.Count > 0)
            return true;

        return status is JobStatus.InProgress or JobStatus.Paused;
    }

    private static double GetElapsedWorkHours(
        IReadOnlyList<WorkInterval> intervals,
        DateTime now)
    {
        var nowMoscow = AppDateTime.ToMoscowWallClockFromApp(now);
        double totalHours = 0;
        foreach (var interval in intervals)
        {
            var start = AppDateTime.ToMoscowWallClockFromDb(interval.StartTime);
            var end = interval.EndTime.HasValue
                ? AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value)
                : nowMoscow;
            if (end <= start)
                continue;
            totalHours += WorkHours.GetWorkHoursBetween(start, end);
        }

        return totalHours;
    }
}
