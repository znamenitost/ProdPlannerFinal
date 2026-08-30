using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.DayPlan;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Tests;

public class DayPlanServiceTests
{
    [Fact]
    public async Task GetDayPlan_packsRankedTasks_andLeavesUnrankedOut()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db, now);

        db.ProductionTasks.AddRange(
            new ProductionTask
            {
                DisplayOrder = 1,
                FolderPath = "ЗаказА",
                FileName = "a.cdr",
                Comment = "срочно",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 2,
                PriorityRank = 1,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            new ProductionTask
            {
                DisplayOrder = 2,
                FolderPath = "ЗаказБ",
                FileName = "b.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 3,
                CreatedAt = now,
                UpdatedAt = now
            });
        await db.SaveChangesAsync();

        var plan = await service.GetDayPlanAsync("Дима", "2026-08-24", now);

        var wave = Assert.Single(plan.Waves);
        Assert.Equal(1, wave.Rank);
        var block = Assert.Single(wave.Blocks);
        Assert.Equal(2, block.Hours);
        Assert.Equal("a.cdr", block.Task.FileName);
        Assert.Equal("срочно", block.Task.Comment);
        Assert.Single(plan.Unplanned);
        Assert.Equal("b.cdr", plan.Unplanned[0].FileName);
        Assert.Equal(2, plan.PlannedHoursToday);
    }

    [Fact]
    public async Task GetDayPlan_compactsGappyRanks_from_2_3_4_to_1_2_3()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db, now);

        db.ProductionTasks.AddRange(
            new ProductionTask
            {
                DisplayOrder = 1,
                FolderPath = "ЗаказА",
                FileName = "a.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 1,
                PriorityRank = 2,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            new ProductionTask
            {
                DisplayOrder = 2,
                FolderPath = "ЗаказБ",
                FileName = "b.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 1,
                PriorityRank = 2,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            new ProductionTask
            {
                DisplayOrder = 3,
                FolderPath = "ЗаказВ",
                FileName = "c.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 1,
                PriorityRank = 4,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        await db.SaveChangesAsync();

        var plan = await service.GetDayPlanAsync("Дима", "2026-08-24", now);

        Assert.Equal(new[] { 1, 2 }, plan.Waves.Select(w => w.Rank).ToArray());
        Assert.Equal(2, plan.Waves[0].Blocks.Count);
        Assert.Equal(1, plan.Waves[1].Blocks.Count);
        Assert.All(db.ProductionTasks, t => Assert.True(t.PriorityRank is 1 or 2));
    }

    [Fact]
    public async Task GetDayPlan_sameRank_packsParallelLanes()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db, now);

        db.ProductionTasks.AddRange(
            new ProductionTask
            {
                DisplayOrder = 1,
                FolderPath = "ЗаказА",
                FileName = "a.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 1,
                PriorityRank = 1,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            new ProductionTask
            {
                DisplayOrder = 2,
                FolderPath = "ЗаказБ",
                FileName = "b.cdr",
                Comment = "",
                Type = "Сборка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 1,
                PriorityRank = 1,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        await db.SaveChangesAsync();

        var plan = await service.GetDayPlanAsync("Дима", "2026-08-24", now);

        var wave = Assert.Single(plan.Waves);
        Assert.Equal(2, wave.Blocks.Count);
        Assert.Equal(2, wave.LaneCount);
        Assert.Equal(2, plan.MaxParallel);
    }

    [Fact]
    public async Task GetDayPlan_splitChild_keepsParentRowNumberAndPartners()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db, now);

        var parent = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "ЗаказА",
            FileName = "a.cdr",
            Comment = "",
            Type = "Резка",
            EmployeeName = "",
            Status = JobStatus.Assigned,
            EstimateHours = 2,
            IsSplitTask = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ProductionTasks.Add(parent);
        await db.SaveChangesAsync();

        var dima = new ProductionTask
        {
            DisplayOrder = 2,
            FolderPath = "ЗаказА",
            FileName = "a.cdr [Резка]",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Дима",
            Status = JobStatus.Assigned,
            EstimateHours = 1,
            PriorityRank = 1,
            IsPriorityMarked = true,
            IsSplitTask = true,
            ParentRowNumber = parent.Id,
            CreatedAt = now,
            UpdatedAt = now
        };
        var yaromir = new ProductionTask
        {
            DisplayOrder = 3,
            FolderPath = "ЗаказА",
            FileName = "a.cdr [УФ ДТФ]",
            Comment = "",
            Type = "УФ ДТФ",
            EmployeeName = "Яромир",
            Status = JobStatus.Assigned,
            EstimateHours = 1,
            IsSplitTask = true,
            ParentRowNumber = parent.Id,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ProductionTasks.AddRange(dima, yaromir);
        await db.SaveChangesAsync();
        db.TaskSplits.AddRange(
            new TaskSplit { ParentRowNumber = parent.Id, ChildTaskId = dima.Id, AssignedTo = "Дима", SplitType = "Резка", SequenceOrder = 1 },
            new TaskSplit { ParentRowNumber = parent.Id, ChildTaskId = yaromir.Id, AssignedTo = "Яромир", SplitType = "УФ ДТФ", SequenceOrder = 1 });
        await db.SaveChangesAsync();

        var plan = await service.GetDayPlanAsync("Дима", "2026-08-24", now);

        var child = Assert.Single(plan.Waves.SelectMany(w => w.Blocks)).Task;
        Assert.Equal(parent.Id, child.ParentRowNumber);
        Assert.Contains("Яромир", child.PartnerNames);
    }

    [Fact]
    public async Task GetDayPlan_marksHasCdrPreview_fromStoredPreview()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db, now);

        var task = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "ЗаказА",
            FileName = "a.cdr",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Дима",
            Status = JobStatus.Assigned,
            EstimateHours = 2,
            PriorityRank = 1,
            IsPriorityMarked = true,
            CreatedAt = now,
            UpdatedAt = now
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
            UpdatedAt = now
        });
        await db.SaveChangesAsync();

        var plan = await service.GetDayPlanAsync("Дима", "2026-08-24", now);
        var block = Assert.Single(Assert.Single(plan.Waves).Blocks);
        Assert.True(block.Task.HasCdrPreview);
    }

    [Fact]
    public async Task GetDayPlan_keepsOverflowRankedTask_onTheBoard()
    {
        await using var db = CreateDb();
        var now = new DateTime(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);
        var service = CreateService(db, now);

        db.ProductionTasks.AddRange(
            new ProductionTask
            {
                DisplayOrder = 1,
                FolderPath = "ЗаказА",
                FileName = "a.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 9,
                PriorityRank = 1,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            new ProductionTask
            {
                DisplayOrder = 2,
                FolderPath = "ЗаказБ",
                FileName = "b.cdr",
                Comment = "",
                Type = "Резка",
                EmployeeName = "Дима",
                Status = JobStatus.Assigned,
                EstimateHours = 3,
                PriorityRank = 2,
                IsPriorityMarked = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        await db.SaveChangesAsync();

        var plan = await service.GetDayPlanAsync("Дима", "2026-08-24", now);

        Assert.Equal(2, plan.Waves.Count);
        Assert.Contains(plan.Waves, w => w.Rank == 2 && w.Blocks.Any(b => b.Task.FileName == "b.cdr"));
        Assert.DoesNotContain(plan.Unplanned, t => t.FileName == "b.cdr");
        Assert.True(plan.TailHours > 0);
    }

    private static DayPlanService CreateService(ApplicationDbContext db, DateTime now)
    {
        var clock = new FixedAppTimeService(now);
        return new DayPlanService(
            new ProductionTaskRepository(db, clock),
            new WorkHoursCalculator(),
            new TaskCdrPreviewService(db, clock));
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source=day-plan-{Guid.NewGuid():N}")
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
