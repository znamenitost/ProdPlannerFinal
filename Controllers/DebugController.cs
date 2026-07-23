using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Infrastructure.Logging;
using ProductionPlanner.Hubs;
using ProductionPlanner.Services;
using ProductionPlanner.Models;
using System.Security.Cryptography;
using System.Text;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/debug")]
[Authorize(Roles = "Admin")]
public class DebugController : ControllerBase
{
    private readonly IProductionTaskRepository _repo;
    private readonly ApplicationDbContext _context;
    private readonly IAppTimeService _timeService;
    private readonly IWorkHoursCalculator _workHours;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly NotificationConnectionRegistry _connections;

    public DebugController(
        IProductionTaskRepository repo,
        ApplicationDbContext context,
        IAppTimeService timeService,
        IWorkHoursCalculator workHours,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        NotificationConnectionRegistry connections)
    {
        _repo = repo;
        _context = context;
        _timeService = timeService;
        _workHours = workHours;
        _environment = environment;
        _configuration = configuration;
        _connections = connections;
    }

    private ActionResult? DevOnly() =>
        _environment.IsDevelopment() ? null : NotFound();

    [HttpGet("logs")]
    public IActionResult GetLogs(
        [FromQuery] bool warning = true,
        [FromQuery] bool error = true,
        [FromQuery] int tail = 500)
    {
        var levels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (warning) levels.Add("Warning");
        if (error)
        {
            levels.Add("Error");
            levels.Add("Critical");
        }

        if (levels.Count == 0)
        {
            return Ok(new
            {
                path = "logs/app.log",
                fileSizeBytes = 0L,
                entries = Array.Empty<object>()
            });
        }

        var path = GetLogFilePath();
        var fileSizeBytes = System.IO.File.Exists(path) ? new FileInfo(path).Length : 0L;
        var entries = AppLogReader.ReadEntries(path, levels, tail);

        return Ok(new
        {
            path = "logs/app.log",
            fileSizeBytes,
            entries = entries.Select(e => new
            {
                e.Timestamp,
                e.Level,
                e.Category,
                e.Message,
                details = e.Details
            })
        });
    }

    private static string GetLogFilePath() =>
        Path.Combine(Directory.GetCurrentDirectory(), "logs", "app.log");

    [HttpGet("db-integrity")]
    public async Task<IActionResult> GetDatabaseIntegrity(CancellationToken cancellationToken)
    {
        var report = await DatabaseIntegrityChecker.RunAsync(_context, _workHours, cancellationToken);
        return Ok(new
        {
            ok = report.Ok,
            capturedAt = report.CapturedAt,
            checks = report.Checks.Select(c => new
            {
                c.Id,
                c.Title,
                c.Severity,
                c.Count,
                sampleIds = c.SampleIds,
                samples = c.Samples.Select(s => new
                {
                    s.Id,
                    s.Title,
                    s.File,
                    s.Note
                }),
                c.Hint
            })
        });
    }

    [HttpGet("connections")]
    public IActionResult GetConnections()
    {
        var snapshot = _connections.GetSnapshot();
        double? workingSetMb = null;
        try
        {
            workingSetMb = Math.Round(
                System.Diagnostics.Process.GetCurrentProcess().WorkingSet64 / 1024.0 / 1024.0,
                2);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEBUG] Working set unavailable: {ex.Message}");
        }

        return Ok(new
        {
            signalR = new
            {
                snapshot.ActiveTotal,
                snapshot.TotalOpened,
                totalClosed = snapshot.TotalClosed,
                snapshot.UsersOnline,
                snapshot.MaxConnectionsPerUser,
                balance = snapshot.Balance,
                byUser = snapshot.ByUser
            },
            memory = new
            {
                gcHeapMb = Math.Round(GC.GetTotalMemory(false) / 1024.0 / 1024.0, 2),
                workingSetMb
            },
            capturedAt = DateTime.UtcNow
        });
    }

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
    public async Task<IActionResult> ResetDatabase([FromBody] ResetDatabaseRequest? request, CancellationToken cancellationToken)
    {
        if (ValidateResetPassword(request) is { } denied) return denied;

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

    [HttpPost("verify-reset-db-password")]
    public IActionResult VerifyResetDatabasePassword([FromBody] ResetDatabaseRequest? request)
    {
        if (ValidateResetPassword(request) is { } denied) return denied;
        return Ok(new { message = "Пароль подходит" });
    }

    [HttpPost("recalculate-statistics")]
    public async Task<IActionResult> RecalculateStatistics(CancellationToken cancellationToken)
    {
        var now = _timeService.Now;
        var completedTasks = await _context.ProductionTasks
            .Include(t => t.WorkIntervals)
            .Where(t => t.Status == JobStatus.Completed
                && !(t.IsSplitTask && t.ParentRowNumber == null))
            .ToListAsync(cancellationToken);

        var changedActualHours = 0;
        var aggregates = new Dictionary<string, (double TotalSaved, double TodaySaved)>();

        foreach (var task in completedTasks)
        {
            var actualHours = CalculateActualHoursFromIntervals(task.WorkIntervals);
            if (Math.Abs(task.ActualHours - actualHours) > 0.005)
                changedActualHours++;

            task.ActualHours = actualHours;
            task.UpdatedAt = now;

            if (task.IsFuss || string.IsNullOrWhiteSpace(task.EmployeeName))
                continue;

            var savedHours = task.EstimateHours - actualHours;
            var completedToday = task.CompletedAt.HasValue
                && AppDateTime.ToMoscowWallClockFromDb(task.CompletedAt.Value).Date == now.Date;

            aggregates.TryGetValue(task.EmployeeName, out var current);
            aggregates[task.EmployeeName] = (
                current.TotalSaved + savedHours,
                current.TodaySaved + (completedToday ? savedHours : 0));
        }

        var stats = await _context.EmployeeStats.ToListAsync(cancellationToken);
        var knownEmployees = stats.Select(s => s.EmployeeName).ToHashSet(StringComparer.Ordinal);

        foreach (var stat in stats)
        {
            aggregates.TryGetValue(stat.EmployeeName, out var aggregate);
            stat.TotalSavedHours = aggregate.TotalSaved;
            stat.TodaySavedHours = aggregate.TodaySaved;
            stat.LastResetDate = now.Date;
        }

        foreach (var (employeeName, aggregate) in aggregates)
        {
            if (knownEmployees.Contains(employeeName))
                continue;

            _context.EmployeeStats.Add(new EmployeeStat
            {
                EmployeeName = employeeName,
                TotalSavedHours = aggregate.TotalSaved,
                TodaySavedHours = aggregate.TodaySaved,
                LastResetDate = now.Date
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Статистика пересчитана",
            tasksProcessed = completedTasks.Count,
            tasksChanged = changedActualHours,
            employeesProcessed = aggregates.Count
        });
    }

    private ActionResult? ValidateResetPassword(ResetDatabaseRequest? request)
    {
        var configuredPassword = _configuration["Debug:ResetDatabasePassword"];
        if (string.IsNullOrWhiteSpace(configuredPassword))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Пароль сброса базы данных не настроен" });

        var providedPassword = GetProvidedResetPassword(request);
        if (!PasswordMatches(providedPassword, configuredPassword))
            return Unauthorized(new { message = "Неверный пароль сброса базы данных" });

        return null;
    }

    private string? GetProvidedResetPassword(ResetDatabaseRequest? request)
    {
        if (!string.IsNullOrWhiteSpace(request?.Password)) return request.Password;
        return Request.Headers.TryGetValue("X-Reset-Db-Password", out var headerPassword)
            ? headerPassword.ToString()
            : null;
    }

    private static bool PasswordMatches(string? provided, string configured)
    {
        var normalizedProvided = NormalizePassword(provided);
        var normalizedConfigured = NormalizePassword(configured);
        if (string.IsNullOrEmpty(normalizedProvided) || string.IsNullOrEmpty(normalizedConfigured)) return false;

        var providedBytes = Encoding.UTF8.GetBytes(normalizedProvided);
        var configuredBytes = Encoding.UTF8.GetBytes(normalizedConfigured);
        return providedBytes.Length == configuredBytes.Length
            && CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes);
    }

    private static string NormalizePassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password)) return "";

        var normalized = password.Trim().TrimEnd(',').Trim();
        if (normalized.Length >= 2
            && ((normalized[0] == '"' && normalized[^1] == '"')
                || (normalized[0] == '\'' && normalized[^1] == '\'')))
        {
            normalized = normalized[1..^1].Trim();
        }

        return normalized;
    }

    [HttpGet("get-intervals/{taskId}")]
    public async Task<IActionResult> GetIntervals(int taskId)
    {
        var task = await _repo.GetTaskByIdAsync(taskId, includeIntervals: true);
        if (task == null) return NotFound();
        return Ok(task.WorkIntervals.Select(i => new { i.Id, i.StartTime, i.EndTime }));
    }

    private double CalculateActualHoursFromIntervals(IEnumerable<WorkInterval> intervals)
    {
        var total = intervals
            .Where(interval => interval.EndTime.HasValue)
            .Sum(interval => _workHours.GetWorkHoursBetween(
                AppDateTime.ToMoscowWallClockFromDb(interval.StartTime),
                AppDateTime.ToMoscowWallClockFromDb(interval.EndTime!.Value)));

        return Math.Round(total, 2);
    }
    
}

public class SetTimeRequest
{
    public string MockDateTime { get; set; } = "";
}

public class ResetDatabaseRequest
{
    public string Password { get; set; } = "";
}
