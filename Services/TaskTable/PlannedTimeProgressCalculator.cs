using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

/// <summary>
/// Плановый % выполнения по времени: отработанные часы / выделенные часы после старта задачи.
/// </summary>
public static class PlannedTimeProgressCalculator
{
    public static double GetPercent(
        ProductionTask task,
        IReadOnlyList<WorkInterval> intervals,
        DateTime now)
    {
        if (task.EstimateHours <= 0)
            return 0;

        if (task.Status == JobStatus.Completed)
            return 100;

        if (!HasWorkStarted(task.Status, intervals))
            return 0;

        var elapsedHours = GetElapsedWorkHours(intervals, now);
        var percent = elapsedHours / task.EstimateHours * 100;
        return Math.Clamp(percent, 0, 100);
    }

    public static bool ShouldShow(ProductionTask task, IReadOnlyList<WorkInterval> intervals) =>
        task.EstimateHours > 0
        && (HasWorkStarted(task.Status, intervals) || task.Status == JobStatus.Completed);

    private static bool HasWorkStarted(JobStatus status, IReadOnlyList<WorkInterval> intervals)
    {
        if (intervals.Count > 0)
            return true;

        return status is JobStatus.InProgress or JobStatus.Paused or JobStatus.Completed;
    }

    private static double GetElapsedWorkHours(IReadOnlyList<WorkInterval> intervals, DateTime now)
    {
        double totalMs = 0;
        foreach (var interval in intervals)
        {
            var end = interval.EndTime ?? now;
            if (end <= interval.StartTime)
                continue;
            totalMs += (end - interval.StartTime).TotalMilliseconds;
        }

        return totalMs / (1000 * 60 * 60);
    }
}
