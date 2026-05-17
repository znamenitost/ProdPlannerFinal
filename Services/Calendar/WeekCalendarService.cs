using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos.Calendar;
using ProductionPlanner.Services;

namespace ProductionPlanner.Services.Calendar;

public class WeekCalendarService : IWeekCalendarService
{
    private readonly IProductionTaskRepository _repo;
    private readonly IProductionScheduler _scheduler;

    public WeekCalendarService(
        IProductionTaskRepository repo,
        IProductionScheduler scheduler)
    {
        _repo = repo;
        _scheduler = scheduler;
    }

    public async Task<WeekCalendarResponseDto> GetWeekAsync(string employee, string? startDate, DateTime currentTime)
    {
        var weekStart = WeekCalendarDateHelper.ResolveWeekStart(startDate, currentTime);
        var weekEnd = weekStart.AddDays(7);

        var allEmployeeTasks = await _repo.GetEmployeeTasksAsync(employee);
        var intervals = await _repo.GetWorkIntervalsForDateRangeAsync(employee, weekStart, weekEnd);

        var intervalsByTask = intervals
            .GroupBy(i => i.ProductionTaskId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var task in allEmployeeTasks)
        {
            task.WorkIntervals = intervalsByTask.TryGetValue(task.Id, out var taskIntervals)
                ? taskIntervals
                : new List<WorkInterval>();
        }

        var activeTasksForSchedule = allEmployeeTasks
            .Where(t => t.Status != JobStatus.Completed && !(t.IsSplitTask && t.ParentRowNumber == null))
            .ToList();

        var slots = _scheduler.GetSchedule(activeTasksForSchedule, currentTime);
        var completedTasks = allEmployeeTasks
            .Where(t => t.Status == JobStatus.Completed)
            .ToList();

        var days = new List<WeekCalendarDayDto>();
        for (var day = weekStart; day < weekEnd; day = day.AddDays(1))
        {
            days.Add(BuildDay(
                day,
                currentTime,
                slots,
                allEmployeeTasks,
                completedTasks));
        }

        return new WeekCalendarResponseDto
        {
            Start = weekStart,
            Days = days
        };
    }

    private static WeekCalendarDayDto BuildDay(
        DateTime day,
        DateTime currentTime,
        List<ScheduledSlot> slots,
        List<ProductionTask> employeeTasks,
        List<ProductionTask> completedTasks)
    {
        var dayStartTime = day.Date.AddHours(10);
        var dayEndTime = day.Date.AddHours(19);
        var lunchStart = day.Date.AddHours(14);
        var lunchEnd = day.Date.AddHours(15);
        var totalWorkHours = (dayEndTime - dayStartTime).TotalHours;

        var taskBlocks = BuildPlannedTaskBlocks(
            day, slots, dayStartTime, dayEndTime, lunchStart, lunchEnd, totalWorkHours);

        var timeline = BuildTimeline(
            day, currentTime, employeeTasks, dayStartTime, dayEndTime, lunchStart, lunchEnd);

        var completedThisDay = completedTasks.Where(t => t.CompletedAt?.Date == day);
        var netSaved = completedThisDay.Sum(t => t.EstimateHours - t.ActualHours);

        var deadlines = employeeTasks
            .Where(t => t.Deadline.Date == day)
            .Select(t => new CalendarDeadlineDto
            {
                Deadline = t.Deadline,
                Status = t.Status.ToString(),
                Progress = t.Progress,
                TaskId = t.Id,
                TaskTitle = t.TaskDisplayName
            })
            .ToList();

        return new WeekCalendarDayDto
        {
            Date = day,
            NetSaved = netSaved,
            TaskBlocks = taskBlocks,
            Timeline = timeline,
            Deadlines = deadlines
        };
    }

    private static List<CalendarTaskBlockDto> BuildPlannedTaskBlocks(
        DateTime day,
        List<ScheduledSlot> slots,
        DateTime dayStartTime,
        DateTime dayEndTime,
        DateTime lunchStart,
        DateTime lunchEnd,
        double totalWorkHours)
    {
        var taskBlocks = new List<CalendarTaskBlockDto>();
        var daySlots = slots.Where(s => s.PlannedStart.Date == day.Date).ToList();

        foreach (var slot in daySlots)
        {
            var start = slot.PlannedStart;
            var end = slot.PlannedEnd;

            if (start < dayStartTime) start = dayStartTime;
            if (end > dayEndTime) end = dayEndTime;
            if (start >= end) continue;

            void AddSegment(DateTime segmentStart, DateTime segmentEnd)
            {
                if (segmentStart >= segmentEnd) return;
                var leftPercent = (segmentStart - dayStartTime).TotalHours / totalWorkHours * 100;
                var widthPercent = (segmentEnd - segmentStart).TotalHours / totalWorkHours * 100;
                var hours = (segmentEnd - segmentStart).TotalHours;

                taskBlocks.Add(new CalendarTaskBlockDto
                {
                    LeftPercent = Math.Round(leftPercent, 2),
                    WidthPercent = Math.Round(widthPercent, 2),
                    Hours = Math.Round(hours, 1),
                    FullTitle = slot.Task.TaskDisplayName,
                    TaskId = slot.Task.Id,
                    Title = slot.Task.TaskDisplayName
                });
            }

            if (start < lunchStart && end > lunchStart)
                AddSegment(start, lunchStart);
            if (start < lunchEnd && end > lunchEnd)
                AddSegment(lunchEnd, end);
            if (start >= dayStartTime && end <= lunchStart)
                AddSegment(start, end);
            if (start >= lunchEnd && end <= dayEndTime)
                AddSegment(start, end);
        }

        return taskBlocks;
    }

    private static List<CalendarTimelineSegmentDto> BuildTimeline(
        DateTime day,
        DateTime currentTime,
        List<ProductionTask> employeeTasks,
        DateTime dayStartTime,
        DateTime dayEndTime,
        DateTime lunchStart,
        DateTime lunchEnd)
    {
        var timeline = new List<CalendarTimelineSegmentDto>();
        var dayDate = day.Date;
        var currentDate = currentTime.Date;

        if (dayDate > currentDate)
            return timeline;

        var timelineEnd = dayDate == currentDate
            ? (currentTime > dayEndTime ? dayEndTime : currentTime)
            : dayEndTime;

        var intervalsForDay = CollectIntervalsForDay(
            employeeTasks, dayDate, currentDate, dayStartTime, dayEndTime, timelineEnd);

        if (intervalsForDay.Count > 0)
        {
            timeline.AddRange(BuildWorkTimelineSegments(intervalsForDay));
            timeline.AddRange(BuildIdleSegments(day, intervalsForDay, timelineEnd));
            timeline = timeline.OrderBy(t => t.Start.Ticks).ToList();
        }

        return timeline;
    }

    private static List<(DateTime start, DateTime end, int taskId, string taskTitle, bool completed)>
        CollectIntervalsForDay(
            List<ProductionTask> employeeTasks,
            DateTime dayDate,
            DateTime currentDate,
            DateTime dayStartTime,
            DateTime dayEndTime,
            DateTime timelineEnd)
    {
        var intervalsForDay = new List<(DateTime start, DateTime end, int taskId, string taskTitle, bool completed)>();

        foreach (var task in employeeTasks)
        {
            foreach (var interval in task.WorkIntervals)
            {
                if (task.Status == JobStatus.Completed && interval.EndTime == null)
                    continue;

                var intervalStart = interval.StartTime;
                var intervalEnd = interval.EndTime ?? timelineEnd;

                if (interval.EndTime == null && dayDate < currentDate)
                    intervalEnd = dayEndTime;
                if (intervalEnd > dayEndTime)
                    intervalEnd = dayEndTime;

                if (intervalStart.Date > dayDate || intervalEnd.Date < dayDate)
                    continue;

                var startInDay = intervalStart > dayStartTime ? intervalStart : dayStartTime;
                var endInDay = intervalEnd < timelineEnd ? intervalEnd : timelineEnd;
                if (startInDay >= endInDay)
                    continue;

                var lunchStartToday = dayDate.AddHours(14);
                var lunchEndToday = dayDate.AddHours(15);

                if (startInDay < lunchStartToday && endInDay > lunchStartToday)
                {
                    var segmentEnd = endInDay < lunchStartToday ? endInDay : lunchStartToday;
                    if (startInDay < segmentEnd)
                        intervalsForDay.Add((startInDay, segmentEnd, task.Id, task.TaskDisplayName, task.Status == JobStatus.Completed));
                }

                if (startInDay < lunchEndToday && endInDay > lunchEndToday)
                {
                    var segmentStart = startInDay > lunchEndToday ? startInDay : lunchEndToday;
                    if (segmentStart < endInDay)
                        intervalsForDay.Add((segmentStart, endInDay, task.Id, task.TaskDisplayName, task.Status == JobStatus.Completed));
                }

                if (endInDay <= lunchStartToday || startInDay >= lunchEndToday)
                {
                    intervalsForDay.Add((startInDay, endInDay, task.Id, task.TaskDisplayName, task.Status == JobStatus.Completed));
                }
            }
        }

        return intervalsForDay;
    }

    private static List<CalendarTimelineSegmentDto> BuildWorkTimelineSegments(
        List<(DateTime start, DateTime end, int taskId, string taskTitle, bool completed)> intervalsForDay)
    {
        var segments = new List<CalendarTimelineSegmentDto>();
        intervalsForDay = intervalsForDay.OrderBy(i => i.start).ToList();

        var events = new List<(DateTime time, int type, int index)>();
        for (var i = 0; i < intervalsForDay.Count; i++)
        {
            events.Add((intervalsForDay[i].start, 1, i));
            events.Add((intervalsForDay[i].end, -1, i));
        }
        events = events.OrderBy(e => e.time).ThenBy(e => e.type == 1 ? 0 : 1).ToList();

        var activeIndices = new List<int>();
        var layerForIndex = new int[intervalsForDay.Count];
        foreach (var ev in events)
        {
            if (ev.type == 1)
            {
                var layer = 0;
                while (activeIndices.Contains(layer)) layer++;
                layerForIndex[ev.index] = layer;
                activeIndices.Add(layer);
            }
            else
            {
                activeIndices.Remove(layerForIndex[ev.index]);
            }
        }

        var maxDepthForIndex = new int[intervalsForDay.Count];
        for (var i = 0; i < intervalsForDay.Count; i++)
        {
            var maxDepth = 0;
            var curStart = intervalsForDay[i].start;
            var curEnd = intervalsForDay[i].end;
            for (var j = 0; j < intervalsForDay.Count; j++)
            {
                if (intervalsForDay[j].start < curEnd && intervalsForDay[j].end > curStart)
                    maxDepth++;
            }
            maxDepthForIndex[i] = maxDepth;
        }

        for (var i = 0; i < intervalsForDay.Count; i++)
        {
            var iv = intervalsForDay[i];
            segments.Add(new CalendarTimelineSegmentDto
            {
                Start = iv.start,
                End = iv.end,
                Type = "work",
                TaskId = iv.taskId,
                TaskTitle = iv.taskTitle,
                Completed = iv.completed,
                Layer = layerForIndex[i],
                MaxDepth = maxDepthForIndex[i]
            });
        }

        return segments;
    }

    private static List<CalendarTimelineSegmentDto> BuildIdleSegments(
        DateTime day,
        List<(DateTime start, DateTime end, int taskId, string taskTitle, bool completed)> intervalsForDay,
        DateTime timelineEnd)
    {
        var idleSegments = new List<CalendarTimelineSegmentDto>();
        var workPeriods = new[] { (TimeSpan.FromHours(10), TimeSpan.FromHours(14)), (TimeSpan.FromHours(15), TimeSpan.FromHours(19)) };

        foreach (var (workStart, workEndPeriod) in workPeriods)
        {
            var periodStart = day + workStart;
            var periodEnd = day + workEndPeriod;
            if (periodEnd > timelineEnd) periodEnd = timelineEnd;
            if (periodStart >= periodEnd) continue;

            var current = periodStart;
            while (current < periodEnd)
            {
                var covering = intervalsForDay.FirstOrDefault(w => w.start <= current && w.end > current);
                if (covering != default)
                {
                    current = covering.end;
                }
                else
                {
                    var next = intervalsForDay.FirstOrDefault(w => w.start > current);
                    var idleEnd = next != default && next.start < periodEnd ? next.start : periodEnd;
                    if (idleEnd > current)
                    {
                        idleSegments.Add(new CalendarTimelineSegmentDto
                        {
                            Start = current,
                            End = idleEnd,
                            Type = "idle",
                            TaskId = null,
                            TaskTitle = null,
                            Completed = false
                        });
                    }
                    current = idleEnd;
                }
            }
        }

        return idleSegments;
    }
}
