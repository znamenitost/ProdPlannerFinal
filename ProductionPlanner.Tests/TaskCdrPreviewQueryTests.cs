using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Tests;

public class TaskCdrPreviewQueryTests
{
    [Fact]
    public async Task GetExistingTaskIdsAsync_translates_to_sql()
    {
        await using var db = CreateDb();
        var task = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "",
            FileName = "a.cdr",
            Comment = "",
            Type = "Резка",
            EmployeeName = "X",
            Status = JobStatus.Assigned,
            Deadline = DateTime.UtcNow,
            EstimateHours = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(task);
        await db.SaveChangesAsync();

        db.TaskCdrPreviews.Add(new TaskCdrPreview
        {
            TaskId = task.Id,
            Data = [0x01],
            ByteSize = 1,
            ContentType = "image/webp",
            SourceKey = "",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var svc = new TaskCdrPreviewService(db, new FixedAppTimeService(DateTime.UtcNow));
        var ids = await svc.GetExistingTaskIdsAsync([task.Id]);

        Assert.Contains(task.Id, ids);
    }

    [Fact]
    public async Task GetAsync_falls_back_to_parent_preview_for_split_child()
    {
        await using var db = CreateDb();
        var parent = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "C:/clients",
            FileName = "order.cdr",
            Comment = "",
            Type = "Резка, Сборка",
            EmployeeName = "",
            Status = JobStatus.InProgress,
            IsSplitTask = true,
            Deadline = DateTime.UtcNow,
            EstimateHours = 2,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(parent);
        await db.SaveChangesAsync();

        var child = new ProductionTask
        {
            DisplayOrder = -1,
            FolderPath = parent.FolderPath,
            FileName = "order.cdr [Резка]",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Дима",
            Status = JobStatus.Assigned,
            ParentRowNumber = parent.Id,
            IsSplitTask = true,
            Deadline = DateTime.UtcNow,
            EstimateHours = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(child);
        await db.SaveChangesAsync();

        db.TaskCdrPreviews.Add(new TaskCdrPreview
        {
            TaskId = parent.Id,
            Data = [0x01, 0x02],
            ByteSize = 2,
            ContentType = "image/webp",
            SourceKey = "parent.cdr",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var svc = new TaskCdrPreviewService(db, new FixedAppTimeService(DateTime.UtcNow));
        var preview = await svc.GetAsync(child.Id);

        Assert.NotNull(preview);
        Assert.Equal([0x01, 0x02], preview.Value.Bytes);
        Assert.True(TaskCdrPreviewService.HasPreview(child.Id, child.ParentRowNumber, new HashSet<int> { parent.Id }));
    }

    private static ApplicationDbContext CreateDb()
    {
        var dbName = $"cdr-query-{Guid.NewGuid():N}";
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
