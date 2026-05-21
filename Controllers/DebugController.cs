using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
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
        if (DevOnly() is { } denied) return denied;
        return Ok(new { 
            now = _timeService.Now,
            realNow = DateTime.Now,
            isMock = _timeService.Now != DateTime.Now
        });
    }

    [HttpPost("set-time")]
    public IActionResult SetTime([FromBody] SetTimeRequest request)
    {
        if (DevOnly() is { } denied) return denied;
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
        if (DevOnly() is { } denied) return denied;
        _timeService.ResetMock();
        Console.WriteLine($"[DEBUG] Time reset to real: {_timeService.Now}");
        return Ok(new { message = "Time reset to real", currentTime = _timeService.Now });
    }

    [HttpPost("close-interval/{taskId}")]
    public async Task<IActionResult> CloseInterval(int taskId)
    {
        if (DevOnly() is { } denied) return denied;
        var task = await _repo.GetTaskByIdAsync(taskId);
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
        if (DevOnly() is { } denied) return denied;
        var task = await _repo.GetTaskByIdAsync(taskId);
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
    public async Task<IActionResult> ResetDatabase()
    {
        await _repo.DeleteAllWorkIntervalsAsync();
        await _repo.DeleteAllTasksAsync();
        
        var allSplits = _context.TaskSplits.ToList();
        _context.TaskSplits.RemoveRange(allSplits);
        
        var stats = await _repo.GetEmployeeStatAsync("Дима");
        if (stats != null)
        {
            stats.TotalSavedHours = 0;
            stats.TodaySavedHours = 0;
            await _repo.UpdateEmployeeStatAsync(stats);
        }
        
        await _context.SaveChangesAsync();
        
        return Ok(new { message = "База данных полностью очищена" });
    }

    [HttpGet("get-intervals/{taskId}")]
    public async Task<IActionResult> GetIntervals(int taskId)
    {
        if (DevOnly() is { } denied) return denied;
        var task = await _repo.GetTaskByIdAsync(taskId);
        if (task == null) return NotFound();
        return Ok(task.WorkIntervals.Select(i => new { i.Id, i.StartTime, i.EndTime }));
    }

    
}

public class SetTimeRequest
{
    public string MockDateTime { get; set; } = "";
}

