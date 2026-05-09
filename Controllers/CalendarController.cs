using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Models;
using System.Globalization;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/calendar")]
public class CalendarController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly IProductionScheduler _scheduler;
    private readonly IWorkHoursCalculator _workHours;
    private readonly IEmployeeStatsService _statsService;
    private readonly IAppTimeService _timeService;
    private readonly ILogger<CalendarController> _logger;

    public CalendarController(
        IProductionTaskRepository repo,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours,
        IEmployeeStatsService statsService,
        IAppTimeService timeService,
        ILogger<CalendarController> logger)
    {
        _repo = repo;
        _scheduler = scheduler;
        _workHours = workHours;
        _statsService = statsService;
        _timeService = timeService;
        _logger = logger;
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] string employee, [FromQuery] string? startDate)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var currentTime = _timeService.Now;
            DateTime weekStart;
            if (!string.IsNullOrEmpty(startDate) && DateTime.TryParseExact(startDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed))
                weekStart = GetMondayOfWeek(parsed);
            else
                weekStart = GetMondayOfWeek(currentTime);

            var weekEnd = weekStart.AddDays(7);

            // Загружаем ВСЕ задачи сотрудника (включая завершённые)
            var allEmployeeTasks = await _repo.GetEmployeeTasksAsync(employee);
            // Загружаем интервалы за неделю
            var intervals = await _repo.GetWorkIntervalsForDateRangeAsync(employee, weekStart, weekEnd);

            // Привязываем интервалы к задачам
            var intervalsByTask = intervals.GroupBy(i => i.ProductionTaskId)
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var task in allEmployeeTasks)
            {
                if (intervalsByTask.TryGetValue(task.Id, out var taskIntervals))
                    task.WorkIntervals = taskIntervals;
                else
                    task.WorkIntervals = new List<WorkInterval>();
            }

            // Активные задачи для плановых блоков (только не завершённые)
            var activeTasksForSchedule = allEmployeeTasks.Where(t => t.Status != JobStatus.Completed).ToList();
            var slots = _scheduler.GetSchedule(activeTasksForSchedule, currentTime);

            // Для таймлайна используем все задачи (чтобы отобразить интервалы завершённых)
            var employeeTasks = allEmployeeTasks;

            var days = new List<object>();
            for (var day = weekStart; day < weekEnd; day = day.AddDays(1))
            {
                var dayStartTime = day.Date.AddHours(10);
                var dayEndTime = day.Date.AddHours(19);
                var totalWorkHours = (dayEndTime - dayStartTime).TotalHours;

                // ПЛАНОВЫЕ БЛОКИ (только активные задачи)
                var taskBlocks = new List<object>();
                var daySlots = slots.Where(s => s.PlannedStart.Date == day.Date).ToList();
                foreach (var slot in daySlots)
                {
                    var start = slot.PlannedStart;
                    var end = slot.PlannedEnd;

                    if (start < dayStartTime) start = dayStartTime;
                    if (end > dayEndTime) end = dayEndTime;
                    if (start >= end) continue;

                    var leftPercent = (start - dayStartTime).TotalHours / totalWorkHours * 100;
                    var widthPercent = (end - start).TotalHours / totalWorkHours * 100;

                    taskBlocks.Add(new
                    {
                        leftPercent = Math.Round(leftPercent, 2),
                        widthPercent = Math.Round(widthPercent, 2),
                        hours = Math.Round((end - start).TotalHours, 1),
                        fullTitle = slot.Task.TaskDisplayName,
                        taskId = slot.Task.Id,
                        title = slot.Task.TaskDisplayName
                    });
                }

                // РЕАЛЬНЫЙ ТАЙМЛАЙН (все задачи, включая завершённые)
                var timeline = new List<object>();
                var dayDate = day.Date;
                var currentDate = currentTime.Date;

                if (dayDate <= currentDate)
                {
                    DateTime timelineEnd;
                    if (dayDate == currentDate)
                        timelineEnd = currentTime > dayEndTime ? dayEndTime : currentTime;
                    else
                        timelineEnd = dayEndTime;

                    var intervalsForDay = new List<(DateTime start, DateTime end, int taskId, string taskTitle, bool completed)>();
                    foreach (var task in employeeTasks)
                    {
                        foreach (var interval in task.WorkIntervals)
                        {
                            if (task.Status == JobStatus.Completed && interval.EndTime == null) continue;

                            var intervalStart = interval.StartTime;
                            var intervalEnd = interval.EndTime ?? timelineEnd;

                            if (interval.EndTime == null && dayDate < currentDate)
                                intervalEnd = dayEndTime;

                            if (intervalEnd > dayEndTime)
                                intervalEnd = dayEndTime;

                            if (intervalStart.Date <= dayDate && intervalEnd.Date >= dayDate)
                            {
                                var startInDay = intervalStart > dayStartTime ? intervalStart : dayStartTime;
                                var endInDay = intervalEnd < timelineEnd ? intervalEnd : timelineEnd;
                                if (startInDay < endInDay)
                                {
                                    intervalsForDay.Add((startInDay, endInDay, task.Id, task.TaskDisplayName, task.Status == JobStatus.Completed));
                                }
                            }
                        }
                    }

                    if (intervalsForDay.Any())
                    {
                        intervalsForDay = intervalsForDay.OrderBy(i => i.start).ToList();

                        var events = new List<(DateTime time, int type, int index)>();
                        for (int i = 0; i < intervalsForDay.Count; i++)
                        {
                            events.Add((intervalsForDay[i].start, 1, i));
                            events.Add((intervalsForDay[i].end, -1, i));
                        }
                        events = events.OrderBy(e => e.time).ThenBy(e => e.type == 1 ? 0 : 1).ToList();

                        var activeIndices = new List<int>();
                        var layerForIndex = new int[intervalsForDay.Count];
                        for (int i = 0; i < events.Count; i++)
                        {
                            var ev = events[i];
                            if (ev.type == 1)
                            {
                                int layer = 0;
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
                        for (int i = 0; i < intervalsForDay.Count; i++)
                        {
                            int maxDepth = 0;
                            var curStart = intervalsForDay[i].start;
                            var curEnd = intervalsForDay[i].end;
                            for (int j = 0; j < intervalsForDay.Count; j++)
                            {
                                if (intervalsForDay[j].start < curEnd && intervalsForDay[j].end > curStart)
                                    maxDepth++;
                            }
                            maxDepthForIndex[i] = maxDepth;
                        }

                        for (int i = 0; i < intervalsForDay.Count; i++)
                        {
                            var iv = intervalsForDay[i];
                            timeline.Add(new
                            {
                                start = iv.start,
                                end = iv.end,
                                type = "work",
                                taskId = iv.taskId,
                                taskTitle = iv.taskTitle,
                                completed = iv.completed,
                                layer = layerForIndex[i],
                                maxDepth = maxDepthForIndex[i]
                            });
                        }
                    }

                    // Простой (idle) – логика без изменений
                    var idleSegments = new List<object>();
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
                                    idleSegments.Add(new
                                    {
                                        start = current,
                                        end = idleEnd,
                                        type = "idle",
                                        taskId = (int?)null,
                                        taskTitle = (string?)null,
                                        completed = false
                                    });
                                }
                                current = idleEnd;
                            }
                        }
                    }
                    timeline.AddRange(idleSegments);
                    timeline = timeline.OrderBy(t => ((DateTime)t.GetType().GetProperty("start")!.GetValue(t)!).Ticks).ToList();
                }

                // Статистика и дедлайны
                var completedTasks = await _repo.GetCompletedTasksAsync(employee);
                var completedThisDay = completedTasks.Where(t => t.CompletedAt?.Date == day);
                double netSaved = completedThisDay.Sum(t => t.EstimateHours - t.ActualHours);

                var deadlines = employeeTasks
                    .Where(t => t.Deadline.Date == day)
                    .Select(t => new { t.Deadline, Status = t.Status.ToString(), t.Progress, TaskId = t.Id, TaskTitle = t.TaskDisplayName })
                    .ToList();

                days.Add(new
                {
                    date = day,
                    netSaved,
                    taskBlocks,
                    timeline,
                    deadlines
                });
            }

            return Ok(new { start = weekStart, days });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetWeek для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private DateTime GetMondayOfWeek(DateTime date)
    {
        int diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-diff).Date;
    }
}