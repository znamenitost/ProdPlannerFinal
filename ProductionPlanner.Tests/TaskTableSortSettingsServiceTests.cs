using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Tests;

public class TaskTableSortSettingsServiceTests
{
    [Fact]
    public async Task Get_returns_null_when_not_saved()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var svc = new TaskTableSortSettingsService(appSettings);

        var loaded = await svc.GetForUserAsync("user-1");

        Assert.Null(loaded);
    }

    [Fact]
    public async Task Save_and_load_roundtrip_per_user()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var svc = new TaskTableSortSettingsService(appSettings);

        var payload = new TaskTableSortSettingsDto
        {
            DeadlineSort = true,
            CompletedBottomSort = false,
            HideCompletedSort = true
        };

        await svc.SaveForUserAsync("user-1", payload);
        await svc.SaveForUserAsync("user-2", new TaskTableSortSettingsDto { DeadlineSort = false });

        var user1 = await svc.GetForUserAsync("user-1");
        var user2 = await svc.GetForUserAsync("user-2");

        Assert.True(user1!.DeadlineSort);
        Assert.False(user1.CompletedBottomSort);
        Assert.True(user1.HideCompletedSort);
        Assert.False(user2!.DeadlineSort);
    }

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"task-table-sort-{Guid.NewGuid():N}";
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source={dbName}")
            .Options;
        var db = new ApplicationDbContext(options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        return db;
    }

    private sealed class FixedAppTimeService(DateTime now) : IAppTimeService
    {
        public DateTime Now => now;
        public void SetMock(DateTime? mockDateTime) { }
        public void ResetMock() { }
    }
}
