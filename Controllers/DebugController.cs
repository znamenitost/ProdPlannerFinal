using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Models;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/debug")]
[Authorize(Roles = "Admin")]
public class DebugController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ApplicationDbContext _context;
    private readonly IAppTimeService _timeService;
    private readonly IWebHostEnvironment _environment;

    public DebugController(
        IProductionTaskRepository repo,
        ApplicationDbContext context,
        IAppTimeService timeService,
        IWebHostEnvironment environment)
    {
        _repo = repo;
        _context = context;
        _timeService = timeService;
        _environment = environment;
    }

    private ActionResult? DevOnly() =>
        _environment.IsDevelopment() ? null : NotFound();

    [HttpGet("memory")]
    public IActionResult GetMemory()
    {
        if (DevOnly() is { } denied) return denied;
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        long memory = GC.GetTotalMemory(true);
        return Ok(new { Bytes = memory, MB = memory / 1024.0 / 1024.0 });
    }

    [HttpGet("get-time")]
    public IActionResult GetTime()
    {
        return Ok(new { 
            now = _timeService.Now,
            realNow = DateTime.Now,
            isMock = _timeService.Now != DateTime.Now
        });
    }

    [HttpPost("set-time")]
    public IActionResult SetTime([FromBody] SetTimeRequest request)
    {
        if (DateTime.TryParse(request.MockDateTime, out var mockTime))
        {
            _timeService.SetMock(mockTime);
            Console.WriteLine($"[DEBUG] Time set to: {mockTime}");
            return Ok(new { message = $"Time set to {mockTime}", currentTime = _timeService.Now });
        }
        return BadRequest(new { message = "Invalid date format" });
    }

    [HttpPost("reset-time")]
    public IActionResult ResetTime()
    {
        _timeService.ResetMock();
        Console.WriteLine($"[DEBUG] Time reset to real: {_timeService.Now}");
        return Ok(new { message = "Time reset to real", currentTime = _timeService.Now });
    }

    [HttpPost("close-interval/{taskId}")]
    public async Task<IActionResult> CloseInterval(int taskId)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, includeIntervals: true);
        if (task == null) return NotFound();

        var openInterval = task.WorkIntervals.FirstOrDefault(i => i.EndTime == null);
        if (openInterval != null)
        {
            openInterval.EndTime = _timeService.Now;
            await _repo.UpdateWorkIntervalAsync(openInterval);
            Console.WriteLine($"[DEBUG] Closed interval for task {taskId} at {_timeService.Now}");
        }
        return Ok();
    }

    [HttpPost("create-interval/{taskId}")]
    public async Task<IActionResult> CreateInterval(int taskId)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, includeIntervals: true);
        if (task == null) return NotFound();

        // Закрываем все открытые интервалы
        foreach (var interval in task.WorkIntervals.Where(i => i.EndTime == null))
        {
            interval.EndTime = _timeService.Now;
            await _repo.UpdateWorkIntervalAsync(interval);
        }

        var newInterval = new WorkInterval
        {
            ProductionTaskId = task.Id,
            StartTime = _timeService.Now,
            EndTime = null
        };
        await _repo.AddWorkIntervalAsync(newInterval);
        
        task.Status = JobStatus.InProgress;
        await _repo.UpdateTaskAsync(task);
        
        Console.WriteLine($"[DEBUG] Created interval for task {taskId} at {_timeService.Now}");
        return Ok();
    }

    [HttpPost("reset-db")]
    public async Task<IActionResult> ResetDatabase(CancellationToken cancellationToken)
    {
        await _repo.DeleteAllWorkIntervalsAsync(cancellationToken);
        await _repo.DeleteAllTasksAsync(cancellationToken);

        var allSplits = await _context.TaskSplits.ToListAsync(cancellationToken);
        if (allSplits.Count > 0)
            _context.TaskSplits.RemoveRange(allSplits);

        var allStats = await _context.EmployeeStats.ToListAsync(cancellationToken);
        foreach (var stat in allStats)
        {
            stat.TotalSavedHours = 0;
            stat.TodaySavedHours = 0;
            stat.LastResetDate = _timeService.Now.Date;
        }

        var allNotifications = await _context.UserNotifications.ToListAsync(cancellationToken);
        if (allNotifications.Count > 0)
            _context.UserNotifications.RemoveRange(allNotifications);

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "База данных полностью очищена" });
    }

    [HttpGet("get-intervals/{taskId}")]
    public async Task<IActionResult> GetIntervals(int taskId)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, includeIntervals: true);
        if (task == null) return NotFound();
        return Ok(task.WorkIntervals.Select(i => new { i.Id, i.StartTime, i.EndTime }));
    }

    
}

public class SetTimeRequest
{
    public string MockDateTime { get; set; } = "";
}

