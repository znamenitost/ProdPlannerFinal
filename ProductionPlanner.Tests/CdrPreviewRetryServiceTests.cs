using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.AppSettings;
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
            new FixedAutoSearchSettings(7));
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_uses_global_minutes()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");

        await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.NotNull(updated?.CdrPreviewRetryAt);
        Assert.Equal(new DateTime(2026, 6, 19, 12, 7, 0), updated.CdrPreviewRetryAt);
        Assert.Equal(1, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_skips_when_auto_search_disabled()
    {
        var disabled = new CdrPreviewRetryService(
            _db,
            new FixedTimeService(_now),
            new FixedAutoSearchSettings(0));
        var task = await SeedTaskAsync("folder", "design.cdr");

        await disabled.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Null(updated!.CdrPreviewRetryAt);
        Assert.Equal(0, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_schedules_for_extensionless_file_name()
    {
        var task = await SeedTaskAsync("Федерация Бодибилдинга", "11,06,26 тт");

        await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.NotNull(updated?.CdrPreviewRetryAt);
        Assert.Equal(1, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_skips_non_cdr_extension()
    {
        var task = await SeedTaskAsync("Федерация Бодибилдинга", "layout.ai");

        await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Null(updated!.CdrPreviewRetryAt);
        Assert.Equal(0, updated.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task GetDueRetriesAsync_skips_future_retry()
    {
        var future = await SeedTaskAsync("folder", "design.cdr");
        future.CdrPreviewRetryAt = _now.AddMinutes(1);
        future.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        var items = await _service.GetDueRetriesAsync();

        Assert.Empty(items);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_returns_false_when_auto_search_disabled()
    {
        var disabled = new CdrPreviewRetryService(
            _db,
            new FixedTimeService(_now),
            new FixedAutoSearchSettings(0));
        var task = await SeedTaskAsync("folder", "design.cdr");

        var scheduled = await disabled.ScheduleSecondAttemptAsync(task.Id);

        Assert.False(scheduled);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_returns_true_when_scheduled()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");

        var scheduled = await _service.ScheduleSecondAttemptAsync(task.Id);

        Assert.True(scheduled);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_keeps_future_timer_on_duplicate_schedule()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        Assert.True(await _service.ScheduleSecondAttemptAsync(task.Id));

        var scheduledAgain = await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.True(scheduledAgain);
        Assert.Equal(1, updated!.CdrPreviewRetryAttempts);
        Assert.Equal(new DateTime(2026, 6, 19, 12, 7, 0), updated.CdrPreviewRetryAt);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_reschedules_after_due_attempt()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        task.CdrPreviewRetryAt = _now.AddMinutes(-1);
        task.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        var scheduled = await _service.ScheduleSecondAttemptAsync(task.Id);

        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.True(scheduled);
        Assert.Equal(2, updated!.CdrPreviewRetryAttempts);
        Assert.Equal(new DateTime(2026, 6, 19, 12, 7, 0), updated.CdrPreviewRetryAt);
    }

    [Fact]
    public async Task ScheduleSecondAttemptAsync_stops_after_max_attempts()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        task.CdrPreviewRetryAt = _now.AddMinutes(-1);
        task.CdrPreviewRetryAttempts = CdrPreviewRetryService.MaxAttempts;
        await _db.SaveChangesAsync();

        var scheduled = await _service.ScheduleSecondAttemptAsync(task.Id);

        Assert.False(scheduled);
        var updated = await _db.ProductionTasks.FindAsync(task.Id);
        Assert.Equal(CdrPreviewRetryService.MaxAttempts, updated!.CdrPreviewRetryAttempts);
    }

    [Fact]
    public async Task GetDueRetriesAsync_returns_only_second_attempt_queue()
    {
        var due = await SeedTaskAsync("folder", "design.cdr");
        due.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 11, 0, 0);
        due.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        var items = await _service.GetDueRetriesAsync();

        Assert.Single(items);
        Assert.Equal(due.Id, items[0].TaskId);
        Assert.Equal(7, items[0].AutoSearchMinutes);
    }

    [Fact]
    public async Task GetDueRetriesAsync_includes_later_attempt_numbers()
    {
        var due = await SeedTaskAsync("folder", "design.cdr");
        due.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 11, 0, 0);
        due.CdrPreviewRetryAttempts = 3;
        await _db.SaveChangesAsync();

        var items = await _service.GetDueRetriesAsync();

        Assert.Single(items);
        Assert.Equal(due.Id, items[0].TaskId);
    }

    [Fact]
    public async Task MarkAutoSearchFailedAsync_clears_retry_state()
    {
        var task = await SeedTaskAsync("folder", "design.cdr");
        task.CdrPreviewRetryAt = new DateTime(2026, 6, 19, 12, 5, 0);
        task.CdrPreviewRetryAttempts = 1;
        await _db.SaveChangesAsync();

        await _service.MarkAutoSearchFailedAsync(task.Id);

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
        public void SetMock(DateTime? mockDateTime) { }
        public void ResetMock() { }
    }

    private sealed class FixedAutoSearchSettings(int minutes) : ICdrPreviewAutoSearchSettingsService
    {
        public Task<CdrPreviewAutoSearchSettingsDto> GetAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new CdrPreviewAutoSearchSettingsDto { Minutes = minutes });

        public Task SaveAsync(CdrPreviewAutoSearchSettingsDto settings, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<int> GetMinutesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(minutes);
    }
}
