using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.LabelPrint;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Tests;

public class TaskSplitRemovalTests
{
    [Fact]
    public async Task UpdateSplitAsync_finalizes_removed_in_progress_child_without_split_ghost()
    {
        await using var provider = BuildServices();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var splitService = scope.ServiceProvider.GetRequiredService<ITaskSplitService>();

        var parent = await SeedSplitParentAsync(db, "shared.cdr");
        var kept = await SeedChildAsync(db, parent, "Иван", "Резка");
        var removed = await SeedChildAsync(db, parent, "Петр", "Сборка");
        removed.Status = JobStatus.InProgress;
        await db.SaveChangesAsync();

        db.WorkIntervals.Add(new WorkInterval
        {
            ProductionTaskId = removed.Id,
            StartTime = DateTime.UtcNow.AddHours(-1),
            EndTime = null
        });
        await db.SaveChangesAsync();

        await splitService.UpdateSplitAsync(
            parent.Id,
            [
                new SplitPart
                {
                    ChildTaskId = kept.Id,
                    EmployeeName = kept.EmployeeName,
                    TaskType = kept.Type,
                    AllocatedHours = kept.EstimateHours
                }
            ],
            SupplyMode.Cooperative);

        var ghost = await db.ProductionTasks
            .AsNoTracking()
            .Include(t => t.WorkIntervals)
            .FirstAsync(t => t.Id == removed.Id);

        Assert.Null(ghost.ParentRowNumber);
        Assert.False(ghost.IsSplitTask);
        Assert.True(ghost.HiddenFromTaskTable);
        Assert.Equal(JobStatus.Completed, ghost.Status);
        Assert.All(ghost.WorkIntervals, i => Assert.NotNull(i.EndTime));
        Assert.False(await db.TaskSplits.AnyAsync(ts => ts.ChildTaskId == removed.Id));

        var report = await DatabaseIntegrityChecker.RunAsync(db, new PassthroughWorkHoursCalculator());
        Assert.Equal(0, report.Checks.First(c => c.Id == "split_child_without_record").Count);
    }

    [Fact]
    public async Task ConvertToRegularTaskAsync_detaches_completed_sibling_without_split_ghost()
    {
        await using var provider = BuildServices();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var splitService = scope.ServiceProvider.GetRequiredService<ITaskSplitService>();

        var parent = await SeedSplitParentAsync(db, "forum.cdr");
        var kept = await SeedChildAsync(db, parent, "Иван", "Резка");
        var sibling = await SeedChildAsync(db, parent, "Петр", "Сборка");
        sibling.Status = JobStatus.Completed;
        sibling.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await splitService.UpdateSplitAsync(
            parent.Id,
            [
                new SplitPart
                {
                    ChildTaskId = kept.Id,
                    EmployeeName = kept.EmployeeName,
                    TaskType = kept.Type,
                    AllocatedHours = kept.EstimateHours
                }
            ],
            SupplyMode.Cooperative);

        var detached = await db.ProductionTasks.AsNoTracking().FirstAsync(t => t.Id == sibling.Id);
        Assert.Null(detached.ParentRowNumber);
        Assert.False(detached.IsSplitTask);
        Assert.True(detached.HiddenFromTaskTable);
        Assert.False(await db.TaskSplits.AnyAsync(ts => ts.ChildTaskId == sibling.Id));

        var report = await DatabaseIntegrityChecker.RunAsync(db, new PassthroughWorkHoursCalculator());
        Assert.Equal(0, report.Checks.First(c => c.Id == "split_child_without_record").Count);
    }

    [Fact]
    public async Task UpdateSplitAsync_preserves_through_test_second_phase_for_original_employee_child()
    {
        await using var provider = BuildServices();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var splitService = scope.ServiceProvider.GetRequiredService<ITaskSplitService>();

        var testCompletedAt = DateTime.UtcNow.AddHours(-3);
        var parent = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "C:/clients",
            FileName = "phase.cdr",
            Comment = "",
            Deadline = DateTime.UtcNow.AddDays(1),
            EstimateHours = 6,
            Type = "Резка",
            EmployeeName = "Иван",
            Status = JobStatus.Approved,
            IsSplitTask = false,
            RequiresTestBeforeProduction = true,
            TestEstimateHours = 2,
            ProductionEstimateHours = 4,
            WorkPhase = TaskWorkPhase.Production,
            TestPhaseCompletedAt = testCompletedAt,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(parent);
        await db.SaveChangesAsync();

        await splitService.UpdateSplitAsync(
            parent.Id,
            [
                new SplitPart
                {
                    EmployeeName = "Иван",
                    TaskType = "Резка",
                    AllocatedHours = 4,
                    RequiresTestBeforeProduction = true,
                    TestEstimateHours = 1.5,
                    ProductionEstimateHours = 2.5
                },
                new SplitPart
                {
                    EmployeeName = "Петр",
                    TaskType = "Сборка",
                    AllocatedHours = 2
                }
            ],
            SupplyMode.Cooperative);

        var children = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.ParentRowNumber == parent.Id)
            .ToListAsync();

        var ivanChild = Assert.Single(children, c => c.EmployeeName == "Иван");
        Assert.Equal(JobStatus.Approved, ivanChild.Status);
        Assert.Equal(TaskWorkPhase.Production, ivanChild.WorkPhase);
        Assert.Equal(testCompletedAt, ivanChild.TestPhaseCompletedAt);
    }

    private static ServiceProvider BuildServices()
    {
        var dbName = $"split-removal-{Guid.NewGuid():N}";
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlite($"Data Source={dbName}"));
        services.AddSingleton<IAppTimeService>(_ => new FixedAppTimeService(DateTime.UtcNow));
        services.AddScoped<IProductionTaskRepository, ProductionTaskRepository>();
        services.AddScoped<ITaskSplitService, TaskSplitService>();
        services.AddScoped<ITaskLifecycleService, TaskLifecycleService>();
        services.AddSingleton<IWorkHoursCalculator>(_ => new PassthroughWorkHoursCalculator());
        services.AddSingleton<IEmployeeStatsService, NoOpEmployeeStatsService>();
        services.AddSingleton<ITaskNotificationService, NoOpTaskNotificationService>();
        services.AddSingleton<ILabelPrintService, NoOpLabelPrintService>();
        services.AddSingleton<ILogger<TaskLifecycleService>>(NullLogger<TaskLifecycleService>.Instance);

        var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        return provider;
    }

    private static async Task<ProductionTask> SeedSplitParentAsync(ApplicationDbContext db, string fileName)
    {
        var parent = new ProductionTask
        {
            DisplayOrder = 1,
            FolderPath = "C:/clients",
            FileName = fileName,
            Comment = "",
            Deadline = DateTime.UtcNow.AddDays(2),
            EstimateHours = 6,
            Type = "Резка, Сборка",
            EmployeeName = "",
            Status = JobStatus.InProgress,
            IsSplitTask = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(parent);
        await db.SaveChangesAsync();
        return parent;
    }

    private static async Task<ProductionTask> SeedChildAsync(
        ApplicationDbContext db,
        ProductionTask parent,
        string employee,
        string taskType)
    {
        var child = new ProductionTask
        {
            DisplayOrder = -1,
            FolderPath = parent.FolderPath,
            FileName = $"{parent.FileName} [{taskType}]",
            Comment = "",
            Deadline = parent.Deadline,
            EstimateHours = 3,
            Type = taskType,
            EmployeeName = employee,
            Status = JobStatus.Assigned,
            ParentRowNumber = parent.Id,
            IsSplitTask = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ProductionTasks.Add(child);
        await db.SaveChangesAsync();

        db.TaskSplits.Add(new TaskSplit
        {
            ParentRowNumber = parent.Id,
            ChildTaskId = child.Id,
            AssignedTo = employee,
            SplitType = taskType,
            AllocatedHours = child.EstimateHours,
            SequenceOrder = await db.TaskSplits.CountAsync(ts => ts.ParentRowNumber == parent.Id) + 1
        });
        await db.SaveChangesAsync();
        return child;
    }

    private sealed class FixedAppTimeService(DateTime now) : IAppTimeService
    {
        public DateTime Now => now;
        public void SetMock(DateTime? mockDateTime) { }
        public void ResetMock() { }
    }

    private sealed class NoOpEmployeeStatsService : IEmployeeStatsService
    {
        public Task AddSavedHoursAsync(string employeeName, double savedHours, DateTime now) =>
            Task.CompletedTask;
        public Task<double> GetTodaySavedHoursAsync(string employeeName, DateTime now) =>
            Task.FromResult(0d);
        public Task ResetTodayIfNeededAsync(string employeeName, DateTime now) =>
            Task.CompletedTask;
    }

    private sealed class NoOpTaskNotificationService : ITaskNotificationService
    {
        public Task NotifyNewTaskAsync(ProductionTask task) => Task.CompletedTask;
        public Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null) => Task.CompletedTask;
        public Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames) => Task.CompletedTask;
        public Task NotifyStatusChangedAsync(ProductionTask task, string newStatus) => Task.CompletedTask;
        public Task NotifyProgressChangedAsync(ProductionTask task, double progress) => Task.CompletedTask;
        public Task NotifyTaskReadyToStartAsync(ProductionTask task, JobStatus readyStatus) => Task.CompletedTask;
        public Task NotifySequentialStageReadyAsync(ProductionTask task, int stageNumber) => Task.CompletedTask;
        public Task NotifyTaskCommentAddedAsync(ProductionTask task, string authorUserId, string? recipientUserId) =>
            Task.CompletedTask;
    }

    private sealed class NoOpLabelPrintService : ILabelPrintService
    {
        public Task<PrintJobDto> EnqueueManualAsync(
            int taskId,
            int quantity = 1,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new PrintJobDto { TaskId = taskId, Copies = quantity });
        public Task<IReadOnlyList<PrintJobDto>> GetPendingJobsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PrintJobDto>>([]);
        public Task<PrintJobDto?> ClaimJobAsync(int jobId, string? agentName, CancellationToken cancellationToken = default) =>
            Task.FromResult<PrintJobDto?>(null);
        public Task<bool> MarkPrintingAsync(int jobId, string? agentName, CancellationToken cancellationToken = default) =>
            Task.FromResult(true);
        public Task<bool> MarkPrintedAsync(int jobId, string? agentName, CancellationToken cancellationToken = default) =>
            Task.FromResult(true);
        public Task<bool> MarkFailedAsync(int jobId, string? agentName, string? errorMessage, CancellationToken cancellationToken = default) =>
            Task.FromResult(true);
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
