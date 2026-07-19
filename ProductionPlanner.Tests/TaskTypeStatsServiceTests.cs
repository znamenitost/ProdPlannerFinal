using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class TaskTypeStatsServiceTests
{
    [Fact]
    public async Task Aggregates_completed_leaves_only_by_type()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 7, 19, 19, 0, 0);

        db.ProductionTasks.AddRange(
            // leaf, completed
            Task(1, "Резка", JobStatus.Completed, actual: 2, isSplit: false, parent: null),
            Task(2, "Резка", JobStatus.Completed, actual: 3, isSplit: false, parent: null),
            Task(3, "УФ Печать", JobStatus.Completed, actual: 10, isSplit: false, parent: null),
            // split parent — exclude
            Task(10, "Резка", JobStatus.Completed, actual: 100, isSplit: true, parent: null),
            // split child leaf — include
            Task(11, "Сборка", JobStatus.Completed, actual: 4, isSplit: true, parent: 10),
            // not completed — exclude
            Task(20, "Резка", JobStatus.InProgress, actual: 1, isSplit: false, parent: null),
            // empty type
            Task(30, "", JobStatus.Completed, actual: 1.5, isSplit: false, parent: null)
        );
        await db.SaveChangesAsync();

        var svc = new TaskTypeStatsService(db, new FixedAppTimeService(now));
        var result = await svc.GetCompletedLeafStatsAsync();

        Assert.Equal(now, result.CalculatedAt);
        Assert.Equal(5, result.TotalTasks);
        Assert.Equal(20.5, result.TotalActualHours, 3);

        Assert.Equal(new[] { "Резка", "УФ Печать", "Сборка", "Без типа" }, result.Items.Select(i => i.Type).ToArray());

        var rezka = result.Items.Single(i => i.Type == "Резка");
        Assert.Equal(2, rezka.TaskCount);
        Assert.Equal(5, rezka.TotalActualHours, 3);

        var print = result.Items.Single(i => i.Type == "УФ Печать");
        Assert.Equal(1, print.TaskCount);
        Assert.Equal(10, print.TotalActualHours, 3);

        var assembly = result.Items.Single(i => i.Type == "Сборка");
        Assert.Equal(1, assembly.TaskCount);
        Assert.Equal(4, assembly.TotalActualHours, 3);

        var empty = result.Items.Single(i => i.Type == "Без типа");
        Assert.Equal(1, empty.TaskCount);
        Assert.Equal(1.5, empty.TotalActualHours, 3);
    }

    [Fact]
    public async Task Empty_db_returns_zero_totals()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 7, 19, 12, 0, 0);
        var svc = new TaskTypeStatsService(db, new FixedAppTimeService(now));

        var result = await svc.GetCompletedLeafStatsAsync();

        Assert.Equal(0, result.TotalTasks);
        Assert.Equal(0, result.TotalActualHours);
        Assert.Empty(result.Items);
        Assert.Equal(now, result.CalculatedAt);
    }

    private static ProductionTask Task(
        int id,
        string type,
        JobStatus status,
        double actual,
        bool isSplit,
        int? parent) =>
        new()
        {
            Id = id,
            FolderPath = "folder",
            FileName = $"file-{id}.cdr",
            Comment = "",
            Type = type,
            EmployeeName = "Дима",
            Status = status,
            ActualHours = actual,
            IsSplitTask = isSplit,
            ParentRowNumber = parent,
            Deadline = new DateTime(2026, 7, 20),
            CreatedAt = new DateTime(2026, 7, 1),
            UpdatedAt = new DateTime(2026, 7, 18),
            CompletedAt = status == JobStatus.Completed ? new DateTime(2026, 7, 18) : null
        };

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"task-type-stats-{Guid.NewGuid():N}";
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
