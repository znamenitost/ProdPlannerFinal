using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Models;
using System.Globalization;
using ProductionPlanner.Controllers;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/calendar")]
public class CalendarController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly IProductionScheduler _scheduler;
    private readonly IWorkHoursCalculator _workHours;
    private readonly IEmployeeStatsService _statsService;
    private readonly ITableRowRepository _tableRepo;

    public CalendarController(
        IProductionTaskRepository repo,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours,
        IEmployeeStatsService statsService,
        ITableRowRepository tableRepo)
    {
        _repo = repo;
        _scheduler = scheduler;
        _workHours = workHours;
        _statsService = statsService;
        _tableRepo = tableRepo;
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] string employee, [FromQuery] string? startDate)
    {
        var now = DebugController.GetCurrentTime();
        DateTime start;

        if (!string.IsNullOrEmpty(startDate) && DateTime.TryParseExact(startDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed))
        {
            start = GetMondayOfWeek(parsed);
        }
        else
        {
            start = GetMondayOfWeek(now);
        }

        var end = start.AddDays(7);
        
        var allTasks = await _repo.GetAllTasksAsync();
        var allTableRows = await _tableRepo.GetAllRowsAsync();
        
        var tasksForCalendar = new List<ProductionTask>();
        foreach (var task in allTasks.Where(t => t.EmployeeName == employee))
        {
            if (task.Status == JobStatus.Completed) continue;
            
            var tableRow = allTableRows.FirstOrDefault(r => r.Id == task.RowNumber);
            if (tableRow == null)
            {
                tasksForCalendar.Add(task);
                continue;
            }
            
            if (tableRow.StatusText == "Готово") continue;
            if (tableRow.StatusText != null && tableRow.StatusText.StartsWith("Разделена")) continue;
            
            bool isParentTask = allTableRows.Any(r => r.ParentRowNumber == tableRow.Id);
            if (isParentTask) continue;
            
            tasksForCalendar.Add(task);
        }
        
        var slots = _scheduler.GetSchedule(tasksForCalendar, now);
        
        var employeeTasks = allTasks.Where(t => t.EmployeeName == employee).ToList();

        var days = new List<object>();
        for (var day = start; day < end; day = day.AddDays(1))
        {
            var intersectingSlots = slots.Where(s => s.PlannedStart < day.AddDays(1) && s.PlannedEnd > day).ToList();

            var taskBlocks = new List<object>();
            foreach (var slot in intersectingSlots.OrderBy(s => s.Task.Deadline))
            {
                var startInDay = slot.PlannedStart > day ? slot.PlannedStart : day;
                var endInDay = slot.PlannedEnd < day.AddDays(1) ? slot.PlannedEnd : day.AddDays(1);
                
                if (day.Date == now.Date && startInDay < now)
                {
                    startInDay = now;
                    var remaining = slot.Task.EstimateHours * (1 - slot.Task.Progress);
                    endInDay = _workHours.AddWorkHours(startInDay, remaining);
                    if (endInDay > day.AddDays(1)) endInDay = day.AddDays(1);
                }
                
                if (startInDay >= endInDay) continue;
                
                var lunchStartTime = day.AddHours(14);
                var lunchEndTime = day.AddHours(15);
                
                if (startInDay < lunchEndTime && endInDay > lunchStartTime)
                {
                    var beforeLunchEnd = lunchStartTime;
                    if (beforeLunchEnd > startInDay)
                    {
                        var hoursBefore = _workHours.GetWorkHoursBetween(startInDay, beforeLunchEnd);
                        if (hoursBefore > 0.001)
                        {
                            var leftPercent = ((startInDay - day).TotalHours - 10) / 9 * 100;
                            var widthPercent = hoursBefore / 9 * 100;
                            taskBlocks.Add(new
                            {
                                title = slot.Task.Title.Length > 20 ? slot.Task.Title.Substring(0, 20) + "..." : slot.Task.Title,
                                fullTitle = slot.Task.Title,
                                hours = hoursBefore,
                                percentage = Math.Round(hoursBefore / 8 * 100),
                                leftPercent = Math.Max(0, leftPercent),
                                widthPercent = Math.Min(100 - leftPercent, widthPercent),
                                deadline = slot.Task.Deadline,
                                taskId = slot.Task.Id
                            });
                        }
                    }
                    
                    var afterLunchStart = lunchEndTime;
                    if (afterLunchStart < endInDay)
                    {
                        var hoursAfter = _workHours.GetWorkHoursBetween(afterLunchStart, endInDay);
                        if (hoursAfter > 0.001)
                        {
                            var leftPercent = ((afterLunchStart - day).TotalHours - 10) / 9 * 100;
                            var widthPercent = hoursAfter / 9 * 100;
                            taskBlocks.Add(new
                            {
                                title = slot.Task.Title.Length > 20 ? slot.Task.Title.Substring(0, 20) + "..." : slot.Task.Title,
                                fullTitle = slot.Task.Title,
                                hours = hoursAfter,
                                percentage = Math.Round(hoursAfter / 8 * 100),
                                leftPercent = Math.Max(0, leftPercent),
                                widthPercent = Math.Min(100 - leftPercent, widthPercent),
                                deadline = slot.Task.Deadline,
                                taskId = slot.Task.Id
                            });
                        }
                    }
                }
                else
                {
                    var hoursInDay = _workHours.GetWorkHoursBetween(startInDay, endInDay);
                    if (hoursInDay <= 0.001) continue;
                    
                    var leftPercent = ((startInDay - day).TotalHours - 10) / 9 * 100;
                    var widthPercent = hoursInDay / 9 * 100;
                    
                    taskBlocks.Add(new
                    {
                        title = slot.Task.Title.Length > 20 ? slot.Task.Title.Substring(0, 20) + "..." : slot.Task.Title,
                        fullTitle = slot.Task.Title,
                        hours = hoursInDay,
                        percentage = Math.Round(hoursInDay / 8 * 100),
                        leftPercent = Math.Max(0, leftPercent),
                        widthPercent = Math.Min(100 - leftPercent, widthPercent),
                        deadline = slot.Task.Deadline,
                        taskId = slot.Task.Id
                    });
                }
            }

            var timeline = new List<object>();
            if (day.Date <= now.Date)
            {
                var realWorkIntervals = new List<(DateTime start, DateTime end, int taskId)>();
                foreach (var task in employeeTasks)
                {
                    foreach (var interval in task.WorkIntervals)
                    {
                        if (task.Status == JobStatus.Completed && interval.EndTime == null) continue;
                        
                        var intervalStart = interval.StartTime;
                        var intervalEnd = interval.EndTime ?? now;
                        var intervalEndDate = intervalEnd;
                        
                        if (intervalStart.Date <= day.Date && intervalEndDate.Date >= day.Date)
                        {
                            var startInDay = intervalStart > day ? intervalStart : day;
                            var endInDay = intervalEndDate < day.AddDays(1) ? intervalEndDate : day.AddDays(1);
                            if (startInDay < endInDay)
                            {
                                realWorkIntervals.Add((startInDay, endInDay, task.Id));
                            }
                        }
                    }
                }

                realWorkIntervals = realWorkIntervals.OrderBy(i => i.start).ToList();
                
                foreach (var (startInDay, endInDay, taskId) in realWorkIntervals)
                {
                    var task = employeeTasks.FirstOrDefault(t => t.Id == taskId);
                    var isCompleted = task?.Status == JobStatus.Completed;
                    timeline.Add(new
                    {
                        start = startInDay,
                        end = endInDay,
                        type = "work",
                        taskId = taskId,
                        taskTitle = task?.Title ?? $"Задача #{taskId}",
                        completed = isCompleted
                    });
                }

                var workPeriods = new[] { (TimeSpan.FromHours(10), TimeSpan.FromHours(14)), (TimeSpan.FromHours(15), TimeSpan.FromHours(19)) };
                foreach (var (workStart, workEnd) in workPeriods)
                {
                    var current = day + workStart;
                    var endWork = day + workEnd;
                    if (day.Date == now.Date && endWork > now) endWork = now;
                    if (endWork > day.AddHours(19)) endWork = day.AddHours(19);
                    
                    while (current < endWork)
                    {
                        var coveringWork = realWorkIntervals.FirstOrDefault(w => w.start <= current && w.end > current);
                        if (coveringWork != default)
                        {
                            current = coveringWork.end;
                        }
                        else
                        {
                            var nextWork = realWorkIntervals.FirstOrDefault(w => w.start > current);
                            var idleEnd = nextWork != default && nextWork.start < endWork ? nextWork.start : endWork;
                            if (idleEnd > current && idleEnd <= day.AddHours(19))
                            {
                                timeline.Add(new
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
                timeline = timeline.OrderBy(t => ((DateTime)t.GetType().GetProperty("start")!.GetValue(t)!).Ticks).ToList();
            }

            var completed = await _repo.GetCompletedTasksAsync(employee);
            var completedThisDay = completed.Where(t => t.CompletedAt?.Date == day);
            double netSaved = 0;
            foreach (var task in completedThisDay)
            {
                netSaved += (task.EstimateHours - task.ActualHours);
            }

            var deadlines = employeeTasks
                .Where(t => t.Deadline.Date == day)
                .Select(t => new { t.Deadline, Status = t.Status.ToString(), t.Progress, TaskId = t.Id, TaskTitle = t.Title })
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

        return Ok(new { start, days });
    }

    private DateTime GetMondayOfWeek(DateTime date)
    {
        int diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-diff).Date;
    }
}