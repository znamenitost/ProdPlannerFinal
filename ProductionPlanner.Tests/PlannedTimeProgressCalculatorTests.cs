using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class PlannedTimeProgressCalculatorTests
{
    [Fact]
    public void GetPercent_BeforeStart_ReturnsZero()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.Assigned };
        var percent = PlannedTimeProgressCalculator.GetPercent(task, [], new DateTime(2026, 5, 23, 12, 0, 0));
        Assert.Equal(0, percent);
    }

    [Fact]
    public void GetPercent_OneHourOfTwo_ReturnsFifty()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.InProgress };
        var start = new DateTime(2026, 5, 23, 11, 0, 0);
        var now = new DateTime(2026, 5, 23, 12, 0, 0);
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
                StartTime = new DateTime(2026, 5, 23, 11, 0, 0),
                EndTime = new DateTime(2026, 5, 23, 11, 30, 0)
            }
        };
        var percent = PlannedTimeProgressCalculator.GetPercent(
            task, intervals, new DateTime(2026, 5, 23, 14, 0, 0));
        Assert.Equal(25, percent, 1);
    }

    [Fact]
    public void GetPercent_WhenCompleted_Returns100()
    {
        var task = new ProductionTask { EstimateHours = 2, Status = JobStatus.Completed };
        var percent = PlannedTimeProgressCalculator.GetPercent(
            task, [], new DateTime(2026, 5, 23, 12, 0, 0));
        Assert.Equal(100, percent);
    }
}
