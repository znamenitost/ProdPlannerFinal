using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Tests;

public class FileOpenSettingsServiceTests
{
    [Fact]
    public async Task Get_returns_config_defaults_when_empty()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FileOpen:WindowsHost"] = "MINIMARKER",
                ["FileOpen:ShareName"] = "Клиенты",
                ["FileOpen:MacSmbHost"] = "minimarker"
            })
            .Build();
        var svc = new FileOpenSettingsService(appSettings, config);

        var loaded = await svc.GetAsync();

        Assert.Equal("MINIMARKER", loaded.WindowsHost);
        Assert.Equal("Клиенты", loaded.ShareName);
        Assert.Equal("minimarker", loaded.MacSmbHost);
    }

    [Fact]
    public async Task Save_and_load_roundtrip()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var config = new ConfigurationBuilder().Build();
        var svc = new FileOpenSettingsService(appSettings, config);

        await svc.SaveAsync(new FileOpenSettingsDto
        {
            WindowsHost = "FILESERVER",
            ShareName = "Jobs",
            MacSmbHost = "fileserver"
        });

        var loaded = await svc.GetAsync();

        Assert.Equal("FILESERVER", loaded.WindowsHost);
        Assert.Equal("Jobs", loaded.ShareName);
        Assert.Equal("fileserver", loaded.MacSmbHost);
    }

    [Fact]
    public async Task Save_rejects_empty_host()
    {
        await using var db = CreateDb();
        var appSettings = new AppSettingsService(db, new FixedAppTimeService(DateTime.UtcNow));
        var svc = new FileOpenSettingsService(appSettings, new ConfigurationBuilder().Build());

        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(new FileOpenSettingsDto
        {
            WindowsHost = "  ",
            ShareName = "Клиенты",
            MacSmbHost = "minimarker"
        }));
    }

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"file-open-{Guid.NewGuid():N}";
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source={dbName}")
            .Options;
        var db = new ApplicationDbContext(options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS AppSettings (
                Key TEXT NOT NULL PRIMARY KEY,
                Json TEXT NOT NULL DEFAULT '{{}}',
                UpdatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'
            );
            """);
        return db;
    }

    private sealed class FixedAppTimeService(DateTime now) : IAppTimeService
    {
        public DateTime Now => now;
        public void SetMock(DateTime? mockDateTime) { }
        public void ResetMock() { }
    }
}
