using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class CalendarQueryTests
{
    [Fact]
    public async Task GetEmployeeTasksForCalendarWeekAsync_ignores_other_employees_intervals()
    {
        await using var db = CreateDb();
        var repo = new ProductionTaskRepository(db, new FixedAppTimeService(DateTime.UtcNow));

        var weekStart = new DateTime(2026, 6, 9, 0, 0, 0, DateTimeKind.Unspecified);
        var weekEnd = weekStart.AddDays(7);

        var ivanTask = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "",
            FileName = "ivan.pdf",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Иван",
            Status = JobStatus.Assigned,
            Deadline = weekStart.AddDays(2),
            EstimateHours = 2,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var petrTask = new ProductionTask
        {
            DisplayOrder = 2,
            FolderPath = "",
            FileName = "petr.pdf",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Петр",
            Status = JobStatus.Assigned,
            Deadline = weekStart.AddDays(2),
            EstimateHours = 2,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.AddRange(ivanTask, petrTask);
        await db.SaveChangesAsync();

        db.WorkIntervals.Add(new WorkInterval
        {
            ProductionTaskId = petrTask.Id,
            StartTime = weekStart.AddHours(10),
            EndTime = weekStart.AddHours(12)
        });
        await db.SaveChangesAsync();

        var ivanTasks = await repo.GetEmployeeTasksForCalendarWeekAsync("Иван", weekStart, weekEnd);

        Assert.Contains(ivanTasks, t => t.Id == ivanTask.Id);
        Assert.DoesNotContain(ivanTasks, t => t.Id == petrTask.Id);
    }

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"calendar-query-{Guid.NewGuid():N}";
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
