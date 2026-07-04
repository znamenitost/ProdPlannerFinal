using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class DailyWorkReportBuilderTests
{
    private static readonly WorkHoursCalculator WorkHours = new();

    [Fact]
    public void Build_sums_multiple_intervals_for_same_task()
    {
        var now = new DateTime(2026, 7, 1, 16, 0, 0, DateTimeKind.Unspecified);
        var task = CreateTask(1, "Феодоровский завод", JobStatus.Paused);
        var day = now.Date;

        var intervals = new List<WorkInterval>
        {
            CreateInterval(1, day.AddHours(10), day.AddHours(11)),
            CreateInterval(1, day.AddHours(12), day.AddHours(14)),
            CreateInterval(1, day.AddHours(15), day.AddHours(16))
        };

        var report = Services.TaskLists.DailyWorkReportBuilder.Build(
            day,
            now,
            intervals,
            new Dictionary<int, ProductionTask> { [1] = task },
            WorkHours);

        Assert.Single(report.Items);
        var item = report.Items[0];
        Assert.Equal("Феодоровский завод", item.Title);
        Assert.False(item.IsCompleted);
        Assert.Equal([1, 2, 1], item.IntervalHours);
        Assert.Equal(4, item.TotalHours);
    }

    [Fact]
    public void Build_single_interval_has_no_breakdown_parts()
    {
        var now = new DateTime(2026, 7, 1, 14, 0, 0, DateTimeKind.Unspecified);
        var task = CreateTask(2, "Арета", JobStatus.Completed);
        var day = now.Date;

        var intervals = new List<WorkInterval>
        {
            CreateInterval(2, day.AddHours(10), day.AddHours(13))
        };

        var report = Services.TaskLists.DailyWorkReportBuilder.Build(
            day,
            now,
            intervals,
            new Dictionary<int, ProductionTask> { [2] = task },
            WorkHours);

        Assert.Single(report.Items);
        var item = report.Items[0];
        Assert.True(item.IsCompleted);
        Assert.Equal([3], item.IntervalHours);
        Assert.Equal(3, item.TotalHours);
    }

    [Fact]
    public void Build_skips_split_parent_tasks()
    {
        var now = new DateTime(2026, 7, 1, 14, 0, 0, DateTimeKind.Unspecified);
        var parent = CreateTask(3, "Общая", JobStatus.InProgress, isSplitParent: true);
        var day = now.Date;
        var intervals = new List<WorkInterval>
        {
            CreateInterval(3, day.AddHours(10), day.AddHours(11))
        };

        var report = Services.TaskLists.DailyWorkReportBuilder.Build(
            day,
            now,
            intervals,
            new Dictionary<int, ProductionTask> { [3] = parent },
            WorkHours);

        Assert.Empty(report.Items);
    }

    [Fact]
    public void Build_open_interval_ends_at_current_time()
    {
        var now = new DateTime(2026, 7, 1, 11, 30, 0, DateTimeKind.Unspecified);
        var task = CreateTask(4, "Текущая", JobStatus.InProgress);
        var day = now.Date;

        var intervals = new List<WorkInterval>
        {
            CreateInterval(4, day.AddHours(10), null)
        };

        var report = Services.TaskLists.DailyWorkReportBuilder.Build(
            day,
            now,
            intervals,
            new Dictionary<int, ProductionTask> { [4] = task },
            WorkHours);

        Assert.Single(report.Items);
        Assert.Equal(1.5, report.Items[0].TotalHours);
    }

    [Fact]
    public void Build_past_day_counts_open_interval_through_end_of_workday()
    {
        var reportDay = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Unspecified);
        var asOf = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Unspecified);
        var task = CreateTask(5, "Вчера", JobStatus.InProgress);

        var intervals = new List<WorkInterval>
        {
            CreateInterval(5, reportDay.AddHours(10), null)
        };

        var report = Services.TaskLists.DailyWorkReportBuilder.Build(
            reportDay,
            asOf,
            intervals,
            new Dictionary<int, ProductionTask> { [5] = task },
            WorkHours);

        Assert.Single(report.Items);
        Assert.Equal(9, report.Items[0].TotalHours);
    }

    private static ProductionTask CreateTask(
        int id,
        string folderPath,
        JobStatus status,
        bool isSplitParent = false)
    {
        return new ProductionTask
        {
            Id = id,
            FolderPath = folderPath,
            FileName = "file.pdf",
            Comment = "",
            Type = "Резка",
            EmployeeName = "Иван",
            Status = status,
            IsSplitTask = isSplitParent,
            ParentRowNumber = isSplitParent ? null : 0,
            Deadline = DateTime.UtcNow,
            EstimateHours = 5,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static WorkInterval CreateInterval(int taskId, DateTime start, DateTime? end) =>
        new()
        {
            Id = taskId * 10,
            ProductionTaskId = taskId,
            StartTime = start,
            EndTime = end
        };
}
