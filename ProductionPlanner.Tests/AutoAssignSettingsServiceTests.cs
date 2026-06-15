using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Tests;

public class AutoAssignSettingsServiceTests
{
    [Fact]
    public async Task Get_returns_disabled_by_default()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var svc = new AutoAssignSettingsService(appSettings);

        var loaded = await svc.GetAsync();

        Assert.False(loaded.Enabled);
    }

    [Fact]
    public async Task Save_and_load_roundtrip()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var svc = new AutoAssignSettingsService(appSettings);

        var payload = new AutoAssignSettingsDto
        {
            Enabled = false,
            TypeRules = new Dictionary<string, List<string>>
            {
                ["Дима"] = ["Резка"],
                ["Яромир"] = ["УФ Печать"]
            }
        };

        await svc.SaveAsync(payload);
        var loaded = await svc.GetAsync();

        Assert.False(loaded.Enabled);
        Assert.Equal(["Резка"], loaded.TypeRules?["Дима"]);
        Assert.Equal(["УФ Печать"], loaded.TypeRules?["Яромир"]);
    }

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"auto-assign-{Guid.NewGuid():N}";
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
