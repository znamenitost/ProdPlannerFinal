using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
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

    public async Task<WeekCalendarResponseDto> GetWeekAsync(
        string employee,
        string? startDate,
        DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var weekStart = WeekCalendarDateHelper.ResolveWeekStart(startDate, currentTime);
        var weekEnd = weekStart.AddDays(7);

        var allEmployeeTasks = await _repo.GetEmployeeTasksForCalendarWeekAsync(
            employee,
            weekStart,
            weekEnd,
            cancellationToken);
        var intervals = await _repo.GetWorkIntervalsForDateRangeAsync(
            employee,
            weekStart,
            weekEnd,
            cancellationToken);
        var lunchIntervals = await _repo.GetLunchIntervalsForDateRangeAsync(
            employee,
            weekStart,
            weekEnd,
            cancellationToken);

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

        // Глобальные (по всей неделе) высота полосы и слой для каждой задачи —
        // чтобы при переходе между днями полоса не меняла высоту/позицию, если задача
        // продолжается. Совпадает со спекой: «так же эта логика работает и с переносом
        // на следующий рабочий день».
        var weekIntervals = CollectIntervalsForWeek(
            allEmployeeTasks, weekStart, weekEnd, currentTime);
        var (layerByTask, maxDepthByTask) = CalendarWeeklyLayout.ComputeWeeklyLayoutForTasks(weekIntervals);

        var days = new List<WeekCalendarDayDto>();
        for (var day = weekStart; day < weekEnd; day = day.AddDays(1))
        {
            days.Add(BuildDay(
                day,
                currentTime,
                slots,
                allEmployeeTasks,
                completedTasks,
                lunchIntervals,
                layerByTask,
                maxDepthByTask));
        }

        return new WeekCalendarResponseDto
        {
            Start = weekStart,
            CurrentTime = currentTime,
            Days = days
        };
    }

    private static WeekCalendarDayDto BuildDay(
        DateTime day,
        DateTime currentTime,
        List<ScheduledSlot> slots,
        List<ProductionTask> employeeTasks,
        List<ProductionTask> completedTasks,
        List<LunchInterval> lunchIntervals,
        IReadOnlyDictionary<int, int> layerByTask,
        IReadOnlyDictionary<int, int> maxDepthByTask)
    {
        var dayStartTime = day.Date.AddHours(10);
        var dayEndTime = day.Date.AddHours(19);
        var totalWorkHours = (dayEndTime - dayStartTime).TotalHours;
        var lunchIntervalsForDay = GetLunchIntervalsForDay(lunchIntervals, day.Date, currentTime, dayEndTime);

        var taskBlocks = BuildPlannedTaskBlocks(
            day, slots, dayStartTime, dayEndTime, lunchIntervalsForDay, totalWorkHours);

        var timeline = BuildTimeline(
            day, currentTime, employeeTasks, dayStartTime, dayEndTime, lunchIntervalsForDay,
            layerByTask, maxDepthByTask);

        var completedThisDay = completedTasks.Where(t =>
            t.CompletedAt.HasValue
            && AppDateTime.ToMoscowWallClockFromDb(t.CompletedAt.Value).Date == day.Date);
        var netSaved = completedThisDay
            .Where(t => !t.IsFuss)
            .Sum(t => t.EstimateHours - t.ActualHours);

        var deadlines = employeeTasks
            .Where(t => t.Deadline.HasValue
                && AppDateTime.ToMoscowWallClockFromDb(t.Deadline.Value).Date == day.Date)
            .Select(t => new CalendarDeadlineDto
            {
                Deadline = t.Deadline!.Value,
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
            LunchIntervals = lunchIntervalsForDay
                .Select(i => new CalendarLunchIntervalDto { StartTime = i.start, EndTime = i.end })
                .ToList(),
            Deadlines = deadlines
        };
    }

    private static List<CalendarTaskBlockDto> BuildPlannedTaskBlocks(
        DateTime day,
        List<ScheduledSlot> slots,
        DateTime dayStartTime,
        DateTime dayEndTime,
        List<(DateTime start, DateTime end)> lunchIntervals,
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
                    Title = slot.Task.TaskDisplayName,
                    FolderPath = slot.Task.FolderPath ?? "",
                    FileName = slot.Task.FileName ?? "",
                    StatusText = TaskTable.TaskStatusMapper.ToDisplayText(slot.Task)
                });
            }

            foreach (var (segmentStart, segmentEnd) in SubtractLunchIntervals(start, end, lunchIntervals))
                AddSegment(segmentStart, segmentEnd);
        }

        return taskBlocks;
    }

    private static List<CalendarTimelineSegmentDto> BuildTimeline(
        DateTime day,
        DateTime currentTime,
        List<ProductionTask> employeeTasks,
        DateTime dayStartTime,
        DateTime dayEndTime,
        List<(DateTime start, DateTime end)> lunchIntervals,
        IReadOnlyDictionary<int, int> layerByTask,
        IReadOnlyDictionary<int, int> maxDepthByTask)
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
            timeline.AddRange(BuildWorkTimelineSegments(intervalsForDay, layerByTask, maxDepthByTask));

        // Простой с 10:00 даже если за день ещё не было интервалов работы
        timeline.AddRange(BuildIdleSegments(day, intervalsForDay, lunchIntervals, timelineEnd));

        if (timeline.Count > 0)
            timeline = timeline.OrderBy(t => t.Start.Ticks).ToList();

        return timeline;
    }

    private static List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        CollectIntervalsForDay(
            List<ProductionTask> employeeTasks,
            DateTime dayDate,
            DateTime currentDate,
            DateTime dayStartTime,
            DateTime dayEndTime,
            DateTime timelineEnd)
    {
        var intervalsForDay = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>();

        foreach (var task in employeeTasks)
        {
            var statusText = TaskTable.TaskStatusMapper.ToDisplayText(task);
            foreach (var interval in task.WorkIntervals)
            {
                if (task.Status == JobStatus.Completed && interval.EndTime == null)
                    continue;

                var intervalStart = AppDateTime.ToMoscowWallClockFromDb(interval.StartTime);
                var intervalEnd = interval.EndTime.HasValue
                    ? AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value)
                    : timelineEnd;

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

                var isOpenInterval = !interval.EndTime.HasValue && task.Status != JobStatus.Completed;
                intervalsForDay.Add((startInDay, endInDay, task.Id, task.TaskDisplayName, task.FolderPath ?? "", task.FileName ?? "", task.Status == JobStatus.Completed, statusText, isOpenInterval));
            }
        }

        return intervalsForDay;
    }

    private static List<CalendarTimelineSegmentDto> BuildWorkTimelineSegments(
        List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)> intervalsForDay,
        IReadOnlyDictionary<int, int> layerByTask,
        IReadOnlyDictionary<int, int> maxDepthByTask)
    {
        if (intervalsForDay.Count == 0)
            return new List<CalendarTimelineSegmentDto>();

        intervalsForDay = CalendarDayWorkLayout.CoalesceIntervalsPerTask(intervalsForDay);
        return CalendarDayWorkLayout.BuildWorkSegments(intervalsForDay, layerByTask, maxDepthByTask);
    }

    /// <summary>
    /// Собирает интервалы работы за всю неделю — одна и та же задача, ползущая через
    /// несколько дней, будет видна как набор кусков. Используется для
    /// глобального расчёта слоя/глубины, чтобы высота полосы не «прыгала» между днями.
    /// </summary>
    private static List<(DateTime start, DateTime end, int taskId)> CollectIntervalsForWeek(
        List<ProductionTask> employeeTasks,
        DateTime weekStart,
        DateTime weekEnd,
        DateTime currentTime)
    {
        var weekIntervals = new List<(DateTime start, DateTime end, int taskId)>();
        var currentDate = currentTime.Date;

        for (var day = weekStart; day < weekEnd; day = day.AddDays(1))
        {
            var dayDate = day.Date;
            if (dayDate > currentDate) break;

            var dayStartTime = dayDate.AddHours(10);
            var dayEndTime = dayDate.AddHours(19);
            var timelineEnd = dayDate == currentDate
                ? (currentTime > dayEndTime ? dayEndTime : currentTime)
                : dayEndTime;
            var dayIntervals = CollectIntervalsForDay(
                employeeTasks, dayDate, currentDate, dayStartTime, dayEndTime, timelineEnd);
            dayIntervals = CalendarDayWorkLayout.CoalesceIntervalsPerTask(dayIntervals);
            foreach (var iv in dayIntervals)
                weekIntervals.Add((iv.start, iv.end, iv.taskId));
        }

        return weekIntervals;
    }

    private static List<CalendarTimelineSegmentDto> BuildIdleSegments(
        DateTime day,
        List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)> intervalsForDay,
        List<(DateTime start, DateTime end)> lunchIntervals,
        DateTime timelineEnd)
    {
        var idleSegments = new List<CalendarTimelineSegmentDto>();
        var workPeriods = new[] { (TimeSpan.FromHours(10), TimeSpan.FromHours(19)) };
        var blockers = intervalsForDay
            .Select(i => (i.start, i.end))
            .Concat(lunchIntervals)
            .OrderBy(i => i.start)
            .ToList();

        foreach (var (workStart, workEndPeriod) in workPeriods)
        {
            var periodStart = day + workStart;
            var periodEnd = day + workEndPeriod;
            if (periodEnd > timelineEnd) periodEnd = timelineEnd;
            if (periodStart >= periodEnd) continue;

            var current = periodStart;
            while (current < periodEnd)
            {
                var covering = blockers.FirstOrDefault(w => w.start <= current && w.end > current);
                if (covering != default)
                {
                    current = covering.end;
                }
                else
                {
                    var next = blockers.FirstOrDefault(w => w.start > current);
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

    private static List<(DateTime start, DateTime end)> GetLunchIntervalsForDay(
        List<LunchInterval> lunchIntervals,
        DateTime dayDate,
        DateTime currentTime,
        DateTime dayEndTime)
    {
        var result = new List<(DateTime start, DateTime end)>();
        var dayStartTime = dayDate.AddHours(10);

        foreach (var interval in lunchIntervals)
        {
            var start = AppDateTime.ToMoscowWallClockFromDb(interval.StartTime);
            var end = interval.EndTime.HasValue
                ? AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value)
                : currentTime;

            if (start.Date > dayDate || end.Date < dayDate)
                continue;

            var startInDay = start > dayStartTime ? start : dayStartTime;
            var endInDay = end < dayEndTime ? end : dayEndTime;
            if (startInDay < endInDay)
                result.Add((startInDay, endInDay));
        }

        return result
            .OrderBy(i => i.start)
            .ToList();
    }

    private static List<(DateTime start, DateTime end)> SubtractLunchIntervals(
        DateTime start,
        DateTime end,
        List<(DateTime start, DateTime end)> lunchIntervals)
    {
        var segments = new List<(DateTime start, DateTime end)> { (start, end) };

        foreach (var lunch in lunchIntervals)
        {
            var next = new List<(DateTime start, DateTime end)>();
            foreach (var segment in segments)
            {
                if (segment.end <= lunch.start || segment.start >= lunch.end)
                {
                    next.Add(segment);
                    continue;
                }

                if (segment.start < lunch.start)
                    next.Add((segment.start, lunch.start));
                if (segment.end > lunch.end)
                    next.Add((lunch.end, segment.end));
            }

            segments = next;
            if (segments.Count == 0)
                break;
        }

        return segments
            .Where(s => s.start < s.end)
            .ToList();
    }
}
