using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class DatabaseIntegrityCheckerTests
{
    [Fact]
    public async Task RunAsync_reports_orphan_child_and_open_interval_issues()
    {
        await using var db = CreateDb();
        var parent = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "",
            FileName = "parent.pdf",
            Comment = "",
            Deadline = DateTime.UtcNow.AddDays(1),
            EstimateHours = 4,
            Type = "Резка",
            EmployeeName = "",
            Status = JobStatus.Assigned,
            IsSplitTask = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(parent);
        await db.SaveChangesAsync();

        var orphan = new ProductionTask
        {
            DisplayOrder = -1,
            FolderPath = "",
            FileName = "child.pdf",
            Comment = "",
            Deadline = parent.Deadline,
            EstimateHours = 2,
            Type = "Резка",
            EmployeeName = "Иван",
            Status = JobStatus.InProgress,
            ParentRowNumber = 9999,
            IsSplitTask = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(orphan);
        await db.SaveChangesAsync();

        db.WorkIntervals.AddRange(
            new WorkInterval { ProductionTaskId = orphan.Id, StartTime = DateTime.UtcNow.AddHours(-2), EndTime = null },
            new WorkInterval { ProductionTaskId = orphan.Id, StartTime = DateTime.UtcNow.AddHours(-1), EndTime = null });
        await db.SaveChangesAsync();

        var report = await DatabaseIntegrityChecker.RunAsync(db, new PassthroughWorkHoursCalculator());

        Assert.False(report.Ok);
        Assert.True(report.Checks.First(c => c.Id == "orphan_children").Count > 0);
        Assert.True(report.Checks.First(c => c.Id == "multiple_open_intervals").Count > 0);
        Assert.Contains(orphan.Id, report.Checks.First(c => c.Id == "orphan_children").SampleIds);
    }

    [Fact]
    public async Task RunAsync_ok_when_data_is_consistent()
    {
        await using var db = CreateDb();
        var task = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "",
            FileName = "ok.pdf",
            Comment = "",
            Deadline = DateTime.UtcNow.AddDays(1),
            EstimateHours = 2,
            Type = "Резка",
            EmployeeName = "Иван",
            Status = JobStatus.Assigned,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(task);
        await db.SaveChangesAsync();

        var report = await DatabaseIntegrityChecker.RunAsync(db, new PassthroughWorkHoursCalculator());

        Assert.True(report.Ok);
        Assert.All(report.Checks, c => Assert.Equal(0, c.Count));
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        var db = new ApplicationDbContext(options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        return db;
    }

    private sealed class PassthroughWorkHoursCalculator : IWorkHoursCalculator
    {
        public bool IsWorkingHour(DateTime time) => true;
        public bool IsLunchTime(DateTime time) => false;
        public DateTime AddWorkHours(DateTime start, double hours) => start.AddHours(hours);
        public IReadOnlyList<WorkTimeSegment> AllocateWorkTime(DateTime start, double hours) =>
            [new WorkTimeSegment(start, start.AddHours(hours))];
        public double GetWorkHoursBetween(DateTime start, DateTime end) =>
            Math.Round((end - start).TotalHours, 2);
        public DateTime GetNextWorkStart(DateTime from) => from;
    }
}
