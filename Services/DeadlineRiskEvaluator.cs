using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

/// <summary>
/// Единая логика риска по дедлайну: рабочие часы от «сейчас» до дедлайна (Москва).
/// </summary>
public static class DeadlineRiskEvaluator
{
    public const double WarningBufferHours = 2;

    public static (string RiskLevel, double RequiredHours, double AvailableHours) Evaluate(
        ProductionTask task,
        DateTime now,
        IWorkHoursCalculator workHours)
    {
        if (task.IsFuss || task.Status == JobStatus.Completed || task.Progress >= 0.99)
            return ("ok", 0, 0);

        if (!task.Deadline.HasValue)
            return ("ok", 0, 0);

        var hoursNeeded = task.EstimateHours * (1 - task.Progress);
        if (hoursNeeded <= 0.01)
            return ("ok", hoursNeeded, 0);

        if (AppDateTime.CompareDeadlineToAppNow(task.Deadline.Value, now) < 0)
            return ("overdue", hoursNeeded, 0);

        var nowMoscow = AppDateTime.ToMoscowWallClockFromApp(now);
        var deadlineMoscow = AppDateTime.ToMoscowWallClockFromDb(task.Deadline.Value);
        var available = workHours.GetWorkHoursBetween(nowMoscow, deadlineMoscow);

        if (available < hoursNeeded)
            return ("critical", hoursNeeded, available);
        if (available < hoursNeeded + WarningBufferHours)
            return ("warning", hoursNeeded, available);

        return ("ok", hoursNeeded, available);
    }

    /// <summary>Баннер: «внимание» только если дедлайн сегодня или завтра (календарные дни, Москва).</summary>
    public static bool ShouldShowInBanner(string riskLevel, DateTime? deadline, DateTime now)
    {
        if (riskLevel is "overdue" or "critical")
            return true;
        if (riskLevel != "warning" || !deadline.HasValue)
            return false;

        var deadlineMoscow = AppDateTime.ToMoscowWallClockFromDb(deadline.Value);
        var today = AppDateTime.ToMoscowWallClockFromApp(now).Date;
        var deadlineDate = deadlineMoscow.Date;
        return deadlineDate <= today.AddDays(1);
    }

    /// <summary>Совместимость со старыми вызовами с non-nullable deadline.</summary>
    public static bool ShouldShowInBanner(string riskLevel, DateTime deadline, DateTime now) =>
        ShouldShowInBanner(riskLevel, (DateTime?)deadline, now);
}
