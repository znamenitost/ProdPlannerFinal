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

        _service = new CdrPreviewRetryService(
            _db,
            new FixedTimeService(_now),
            Microsoft.Extensions.Options.Options.Create(new CdrPreviewRetryOptions
            {
                RetryDelayMinutes = 5,
                MaxRetryAttempts = 3
            }));
    }

    [Fact]
    public async Task ScheduleRetryAsync_sets_retry_at_for_cdr_task()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");

        await _service.ScheduleRetryAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.NotNull(updated?.CdrPreviewRetryAt);
        Assert.Equal(new DateTime(2026, 6, 19, 12, 5, 0), updated.CdrPreviewRetryAt);
        Assert.Equal(0, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task GetDueRetriesAsync_skips_tasks_with_preview()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        task.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 11, 0, 0);
        _db.TaskCdrPreviews.Add(new TaskCdrPreview
        {
            TaskId = task.Id,
            Data = [1, 2, 3],
            ByteSize = 3,
            UpdatedAt = new DateTime(2026, 6, 19, 10, 0, 0)
        });
        await _db.SaveChangesAsync();

        var due = await _service.GetDueRetriesAsync();

        Assert.Empty(due);
    }

    [Fact]
    public async Task RecordFailedRetryAsync_reschedules_until_max_attempts()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        task.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 11, 0, 0);
        await _db.SaveChangesAsync();

        await _service.RecordFailedRetryAsync(task.Id);
        var afterFirst = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Equal(1, afterFirst!.CdrPreviewRetryAttempts);
        Assert.Equal(new DateTime(2026, 6, 19, 12, 5, 0), afterFirst.CdrPreviewRetryAt);

        await _service.RecordFailedRetryAsync(task.Id);
        await _service.RecordFailedRetryAsync(task.Id);

        var afterLast = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Equal(3, afterLast!.CdrPreviewRetryAttempts);
        Assert.Null(afterLast.CdrPreviewRetryAt);
    }

    [Fact]
    public async Task ClearRetryAsync_resets_state()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        task.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 12, 5, 0);
        task.CdrPreviewRetryAttempts = 2;
        await _db.SaveChangesAsync();

        await _service.ClearRetryAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Null(updated!.CdrPreviewRetryAt);
        Assert.Equal(0, updated.CdrPreviewRetryAttempts);
    }

    private async Task<ProductionTask> SeedTaskAsync(string folderPath, string fileName)
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

        public void SetMock(DateTime? mockNow) { }

        public void ResetMock() { }
    }
}
