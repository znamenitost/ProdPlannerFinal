using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class TaskTableSearchFilterTests
{
    [Fact]
    public async Task Search_matchesAcrossAllPages_notOnlyCurrentSlice()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        await SeedRootTasksAsync(db, count: 60, prefix: "batch-a");
        var target = new ProductionTask
        {
            FolderPath = "Проект",
            FileName = "unique-needle.cdr",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Worker",
            Status = JobStatus.Assigned,
            Deadline = now.AddDays(1),
            EstimateHours = 1,
            CreatedAt = now,
            UpdatedAt = now,
            DisplayOrder = 1
        };
        db.ProductionTasks.Add(target);
        await db.SaveChangesAsync();

        var repo = new ProductionTaskRepository(db, new FixedAppTimeService(DateTime.UtcNow));

        var withoutSearch = await repo.GetRootTasksPaginatedAsync(1, 50, search: null);
        Assert.DoesNotContain(withoutSearch.Items, t => t.FileName == "unique-needle.cdr");

        var withSearch = await repo.GetRootTasksPaginatedAsync(1, 50, search: "needle");
        Assert.Single(withSearch.Items);
        Assert.Equal("unique-needle.cdr", withSearch.Items[0].FileName);
        Assert.Equal(1, withSearch.TotalCount);
    }

    [Fact]
    public async Task Search_includesParentWhenChildMatches()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var parent = new ProductionTask
        {
            FolderPath = "Root",
            FileName = "parent.cdr",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Worker",
            Status = JobStatus.Assigned,
            Deadline = now.AddDays(1),
            EstimateHours = 1,
            CreatedAt = now,
            UpdatedAt = now,
            IsSplitTask = true,
            DisplayOrder = 5
        };
        db.ProductionTasks.Add(parent);
        await db.SaveChangesAsync();

        var child = new ProductionTask
        {
            FolderPath = "Child",
            FileName = "child-needle.cdr",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Worker",
            Status = JobStatus.Assigned,
            Deadline = now.AddDays(1),
            EstimateHours = 1,
            CreatedAt = now,
            UpdatedAt = now,
            ParentRowNumber = parent.Id,
            DisplayOrder = 1
        };
        db.ProductionTasks.Add(child);
        await db.SaveChangesAsync();

        db.TaskSplits.Add(new TaskSplit
        {
            ParentRowNumber = parent.Id,
            ChildTaskId = child.Id,
            AssignedTo = "Worker",
            SplitType = "Резка",
            AllocatedHours = 1,
            SequenceOrder = 1
        });
        await db.SaveChangesAsync();

        var repo = new ProductionTaskRepository(db, new FixedAppTimeService(DateTime.UtcNow));
        var result = await repo.GetRootTasksPaginatedAsync(1, 50, search: "needle");

        Assert.Single(result.Items);
        Assert.Equal(parent.Id, result.Items[0].Id);
    }

    private static async Task SeedRootTasksAsync(ApplicationDbContext db, int count, string prefix)
    {
        var now = DateTime.UtcNow;
        for (var i = 0; i < count; i++)
        {
            db.ProductionTasks.Add(new ProductionTask
            {
                FolderPath = prefix,
                FileName = $"{prefix}-{i:D3}.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Worker",
                Status = JobStatus.Assigned,
                Deadline = now.AddDays(1),
                EstimateHours = 1,
                CreatedAt = now,
                UpdatedAt = now,
                DisplayOrder = count - i
            });
        }

        await db.SaveChangesAsync();
    }

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"task-table-search-{Guid.NewGuid():N}";
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source={dbName}")
            .Options;
        var db = new ApplicationDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private sealed class FixedAppTimeService(DateTime now) : IAppTimeService
    {
        public DateTime Now => now;
        public void SetMock(DateTime? mock) { }
        public void ResetMock() { }
    }
}
