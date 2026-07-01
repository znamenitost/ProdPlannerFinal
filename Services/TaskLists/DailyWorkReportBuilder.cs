using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos.TaskLists;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Services.TaskLists;

public static class DailyWorkReportBuilder
{
    private const int WorkDayStartHour = 10;
    private const int WorkDayEndHour = 19;

    public static DailyWorkReportDto Build(
        DateTime now,
        IReadOnlyList<WorkInterval> intervals,
        IReadOnlyDictionary<int, ProductionTask> tasksById,
        IWorkHoursCalculator workHours)
    {
        var nowMoscow = AppDateTime.ToMoscowWallClockFromApp(now);
        var dayDate = nowMoscow.Date;
        var dayStartTime = dayDate.AddHours(WorkDayStartHour);
        var dayEndTime = dayDate.AddHours(WorkDayEndHour);
        var timelineEnd = nowMoscow > dayEndTime ? dayEndTime : nowMoscow;

        var items = new List<DailyWorkReportItemDto>();

        foreach (var group in intervals.GroupBy(i => i.ProductionTaskId))
        {
            if (!tasksById.TryGetValue(group.Key, out var task))
                continue;

            if (task.IsSplitTask && task.ParentRowNumber == null)
                continue;

            var segmentHours = new List<double>();
            foreach (var interval in group.OrderBy(i => i.StartTime))
            {
                var hours = GetIntervalHoursForDay(
                    task,
                    interval,
                    dayDate,
                    dayStartTime,
                    dayEndTime,
                    timelineEnd,
                    workHours);
                if (hours > 0)
                    segmentHours.Add(hours);
            }

            if (segmentHours.Count == 0)
                continue;

            var totalHours = RoundHours(segmentHours.Sum());
            items.Add(new DailyWorkReportItemDto
            {
                TaskId = task.Id,
                Title = task.TaskDisplayName,
                IntervalHours = segmentHours,
                TotalHours = totalHours,
                IsCompleted = task.Status == JobStatus.Completed,
                StatusText = TaskStatusMapper.ToText(task.Status)
            });
        }

        items = items
            .OrderBy(i => i.IsCompleted)
            .ThenByDescending(i => i.TotalHours)
            .ThenBy(i => i.Title, StringComparer.Ordinal)
            .ToList();

        return new DailyWorkReportDto
        {
            Date = dayDate,
            Items = items,
            TotalHours = RoundHours(items.Sum(i => i.TotalHours))
        };
    }

    private static double GetIntervalHoursForDay(
        ProductionTask task,
        WorkInterval interval,
        DateTime dayDate,
        DateTime dayStartTime,
        DateTime dayEndTime,
        DateTime timelineEnd,
        IWorkHoursCalculator workHours)
    {
        if (task.Status == JobStatus.Completed && interval.EndTime == null)
            return 0;

        var intervalStart = AppDateTime.ToMoscowWallClockFromDb(interval.StartTime);
        var intervalEnd = interval.EndTime.HasValue
            ? AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value)
            : timelineEnd;

        if (intervalEnd > dayEndTime)
            intervalEnd = dayEndTime;

        if (intervalStart.Date > dayDate || intervalEnd.Date < dayDate)
            return 0;

        var startInDay = intervalStart > dayStartTime ? intervalStart : dayStartTime;
        var endInDay = intervalEnd < timelineEnd ? intervalEnd : timelineEnd;
        if (startInDay >= endInDay)
            return 0;

        return RoundHours(workHours.GetWorkHoursBetween(startInDay, endInDay));
    }

    private static double RoundHours(double hours) => Math.Round(hours, 1);
}
