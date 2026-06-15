using ProductionPlanner.Services.Calendar;

namespace ProductionPlanner.Tests;

public class CalendarWeeklyLayoutTests
{
    private static readonly DateTime Monday = new(2026, 6, 15, 0, 0, 0, DateTimeKind.Unspecified);

    [Fact]
    public void SingleTask_singleInterval_hasMaxDepthOne()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId)>
        {
            (Monday.AddHours(10), Monday.AddHours(14), 1)
        };

        var (_, maxDepthByTask) = CalendarWeeklyLayout.ComputeWeeklyLayoutForTasks(intervals);

        Assert.Equal(1, maxDepthByTask[1]);
    }

    [Fact]
    public void TwoTasks_backToBack_haveMaxDepthOne_notHalfHeight()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId)>
        {
            (Monday.AddHours(10), Monday.AddHours(12), 1),
            (Monday.AddHours(12), Monday.AddHours(14), 2)
        };

        var (_, maxDepthByTask) = CalendarWeeklyLayout.ComputeWeeklyLayoutForTasks(intervals);

        Assert.Equal(1, maxDepthByTask[1]);
        Assert.Equal(1, maxDepthByTask[2]);
    }

    [Fact]
    public void TwoTasks_overlapping_haveMaxDepthTwo()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId)>
        {
            (Monday.AddHours(10), Monday.AddHours(13), 1),
            (Monday.AddHours(12), Monday.AddHours(14), 2)
        };

        var (layerByTask, maxDepthByTask) = CalendarWeeklyLayout.ComputeWeeklyLayoutForTasks(intervals);

        Assert.Equal(2, maxDepthByTask[1]);
        Assert.Equal(2, maxDepthByTask[2]);
        Assert.Equal(0, layerByTask[1]);
        Assert.Equal(1, layerByTask[2]);
    }
}
