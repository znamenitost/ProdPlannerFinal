using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Tests;

public class CdrPreviewRetryServiceTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly CdrPreviewRetryService _service;
    private readonly DateTime _now = new(2026, 6, 19, 12, 0, 0);

    public CdrPreviewRetryServiceTests()
    {
        var dbName = $"cdr-retry-{Guid.NewGuid():N}";
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source={dbName}")
            .Options;

        _db = new ApplicationDbContext(options);
        _db.Database.OpenConnection();
        _db.Database.EnsureCreated();

        _service = new CdrPreviewRetryService(_db, new FixedTimeService(_now));
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_uses_task_minutes()
    {
        var task = await SeedTaskAsync("folder", "design.cdr", autoSearchMinutes: 7);

        await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.NotNull(updated?.CdrPreviewRetryAt);
        Assert.Equal(new DateTime(2026, 6, 19, 12, 7, 0), updated.CdrPreviewRetryAt);
        Assert.Equal(1, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_skips_when_auto_search_disabled()
    {
        var task = await SeedTaskAsync("folder", "design.cdr", autoSearchMinutes: 0);

        await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Null(updated!.CdrPreviewRetryAt);
        Assert.Equal(0, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task GetDueRetriesAsync_returns_only_second_attempt_queue()
    {
        var due = await SeedTaskAsync("folder", "design.cdr", autoSearchMinutes: 5);
        due.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 11, 0, 0);
        due.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        var notDue = await SeedTaskAsync("folder", "other.cdr", autoSearchMinutes: 5);
        notDue.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 13, 0, 0);
        notDue.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        var items = await _service.GetDueRetriesAsync();

        Assert.Single(items);
        Assert.Equal(due.Id, items[0].TaskId);
        Assert.Equal(5, items[0].AutoSearchMinutes);
    }

    [Fact]
    public async Task MarkAutoSearchFailedAsync_clears_retry_state()
    {
        var task = await SeedTaskAsync("folder", "design.cdr", autoSearchMinutes: 5);
        task.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 12, 5, 0);
        task.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        await _service.MarkAutoSearchFailedAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Null(updated!.CdrPreviewRetryAt);
        Assert.Equal(0, updated.CdrPreviewRetryAttempts);
    }

    private async Task<ProductionTask> SeedTaskAsync(string folderPath, string fileName, int autoSearchMinutes)
    {
        var task = new ProductionTask
        {
            FolderPath = folderPath,
            FileName = fileName,
            Comment = "test",
            Deadline = new DateTime(2026, 6, 20),
            EstimateHours = 1,
            Type = "test",
            EmployeeName = "Иван",
            Status = JobStatus.Assigned,
            CdrPreviewAutoSearchMinutes = autoSearchMinutes,
            CreatedAt = new DateTime(2026, 6, 19, 10, 0, 0),
            UpdatedAt = new DateTime(2026, 6, 19, 10, 0, 0)
        };
        _db.ProductionTasks.Add(task);
        await _db.SaveChangesAsync();
        return task;
    }

    public void Dispose()
    {
        _db.Database.CloseConnection();
        _db.Dispose();
    }

    private sealed class FixedTimeService(DateTime now) : IAppTimeService
    {
        public DateTime Now => now;
        public void SetMock(DateTime? mockDateTime) { }
        public void ResetMock() { }
    }
}
