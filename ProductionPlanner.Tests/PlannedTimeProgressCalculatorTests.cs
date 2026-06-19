using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class PlannedTimeProgressCalculatorTests
{
    [Fact]
    public void GetPercent_BeforeStart_ReturnsZero()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.Assigned };
        var percent = PlannedTimeProgressCalculator.GetPercent(task, [], new DateTime(2026, 5, 22, 12, 0, 0));
        Assert.Equal(0, percent);
    }

    [Fact]
    public void GetPercent_OneHourOfTwo_ReturnsFifty()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.InProgress };
        var start = new DateTime(2026, 5, 22, 11, 0, 0);
        var now = new DateTime(2026, 5, 22, 12, 0, 0);
        var intervals = new List<WorkInterval>
        {
            new() { StartTime = start, EndTime = null }
        };
        var percent = PlannedTimeProgressCalculator.GetPercent(task, intervals, now);
        Assert.Equal(50, percent, 1);
    }

    [Fact]
    public void GetPercent_WhenPaused_DoesNotGrow()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.Paused };
        var intervals = new List<WorkInterval>
        {
            new()
            {
                StartTime = new DateTime(2026, 5, 22, 11, 0, 0),
                EndTime = new DateTime(2026, 5, 22, 11, 30, 0)
            }
        };
        var percent = PlannedTimeProgressCalculator.GetPercent(
            task, intervals, new DateTime(2026, 5, 22, 14, 0, 0));
        Assert.Equal(25, percent, 1);
    }

    [Fact]
    public void GetPercent_WhenCompleted_Returns100()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.Completed };
        var percent = PlannedTimeProgressCalculator.GetPercent(
            task, [], new DateTime(2026, 5, 22, 12, 0, 0));
        Assert.Equal(100, percent);
    }

    [Fact]
    public void ShouldShow_WhenCompleted_ReturnsFalse()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.Completed };
        Assert.False(PlannedTimeProgressCalculator.ShouldShow(task, []));
    }

    [Fact]
    public void ShouldShow_WhenInProgress_ReturnsTrue()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.InProgress };
        Assert.True(PlannedTimeProgressCalculator.ShouldShow(task, []));
    }

    [Fact]
    public void GetSplitParentPercent_SumsChildrenElapsedOverTotalEstimate()
    {
        var children = new List<ProductionTask>
        {
            new() { Id = 1, EstimateHours = 2, Status = JobStatus.InProgress },
            new() { Id = 2, EstimateHours = 2, Status = JobStatus.Assigned }
        };
        var now = new DateTime(2026, 5, 22, 12, 0, 0);
        var intervalsByChild = new Dictionary<int, IReadOnlyList<WorkInterval>>
        {
            [1] = new List<WorkInterval>
            {
                new()
                {
                    StartTime = new DateTime(2026, 5, 22, 11, 0, 0),
                    EndTime = null
                }
            }
        };

        var percent = PlannedTimeProgressCalculator.GetSplitParentPercent(children, intervalsByChild, now);

        Assert.Equal(25, percent, 1);
    }

    [Fact]
    public void GetSplitParentPercent_WhenFirstChildOvertimeAndSecondNotStarted_CapsAtFirstChildShare()
    {
        var children = new List<ProductionTask>
        {
            new() { Id = 1, EstimateHours = 2, Status = JobStatus.InProgress },
            new() { Id = 2, EstimateHours = 3, Status = JobStatus.Assigned }
        };
        var now = new DateTime(2026, 5, 22, 16, 0, 0);
        var intervalsByChild = new Dictionary<int, IReadOnlyList<WorkInterval>>
        {
            [1] = new List<WorkInterval>
            {
                new()
                {
                    StartTime = new DateTime(2026, 5, 22, 11, 0, 0),
                    EndTime = new DateTime(2026, 5, 22, 16, 0, 0)
                }
            }
        };

        var percent = PlannedTimeProgressCalculator.GetSplitParentPercent(children, intervalsByChild, now);

        Assert.Equal(40, percent, 1);
    }

    [Fact]
    public void GetSplitParentPercent_WhenBothStarted_UsesCappedSumOverTotalEstimate()
    {
        var children = new List<ProductionTask>
        {
            new() { Id = 1, EstimateHours = 2, Status = JobStatus.InProgress },
            new() { Id = 2, EstimateHours = 3, Status = JobStatus.InProgress }
        };
        var now = new DateTime(2026, 5, 22, 13, 30, 0);
        var intervalsByChild = new Dictionary<int, IReadOnlyList<WorkInterval>>
        {
            [1] = new List<WorkInterval>
            {
                new()
                {
                    StartTime = new DateTime(2026, 5, 22, 11, 0, 0),
                    EndTime = new DateTime(2026, 5, 22, 12, 0, 0)
                }
            },
            [2] = new List<WorkInterval>
            {
                new()
                {
                    StartTime = new DateTime(2026, 5, 22, 12, 0, 0),
                    EndTime = null
                }
            }
        };

        var percent = PlannedTimeProgressCalculator.GetSplitParentPercent(children, intervalsByChild, now);

        Assert.Equal(50, percent, 1);
    }

    [Fact]
    public void ShouldShowSplitParent_WhenAnyChildStarted_ReturnsTrue()
    {
        var children = new List<ProductionTask>
        {
            new() { Id = 1, EstimateHours = 2, Status = JobStatus.InProgress },
            new() { Id = 2, EstimateHours = 2, Status = JobStatus.Assigned }
        };
        var intervalsByChild = new Dictionary<int, IReadOnlyList<WorkInterval>>
        {
            [1] = new List<WorkInterval>
            {
                new() { StartTime = new DateTime(2026, 5, 22, 11, 0, 0), EndTime = null }
            }
        };

        Assert.True(PlannedTimeProgressCalculator.ShouldShowSplitParent(children, intervalsByChild, "Начал"));
    }

    [Fact]
    public void ShouldShowSplitParent_WhenAllChildrenCompleted_ReturnsFalse()
    {
        var children = new List<ProductionTask>
        {
            new() { Id = 1, EstimateHours = 2, Status = JobStatus.Completed },
            new() { Id = 2, EstimateHours = 2, Status = JobStatus.Completed }
        };

        Assert.False(PlannedTimeProgressCalculator.ShouldShowSplitParent(
            children, new Dictionary<int, IReadOnlyList<WorkInterval>>(), "Готово"));
    }
}
