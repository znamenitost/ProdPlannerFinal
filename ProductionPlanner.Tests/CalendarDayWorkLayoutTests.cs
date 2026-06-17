using ProductionPlanner.Services.Calendar;

namespace ProductionPlanner.Tests;

public class CalendarDayWorkLayoutTests
{
    private static readonly DateTime Monday = new(2026, 6, 15, 0, 0, 0, DateTimeKind.Unspecified);

    [Fact]
    public void Overlap_appliesGlobalMaxDepth_toAllIntervalsOfTask()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        {
            (Monday.AddHours(17).AddMinutes(15).AddSeconds(35), Monday.AddHours(19), 194, "Арета", "", "medals.cdr", false, "Пауза", false),
            (Monday.AddHours(18).AddMinutes(14).AddSeconds(59.418545), Monday.AddHours(18).AddMinutes(15).AddSeconds(1.011406), 201, "ИП Саксин", "", "cakes", true, "Готово", false)
        };

        var layerByTask = new Dictionary<int, int> { [194] = 0, [201] = 1 };
        var maxDepthByTask = new Dictionary<int, int> { [194] = 2, [201] = 2 };

        var segments = CalendarDayWorkLayout.BuildWorkSegments(intervals, layerByTask, maxDepthByTask);
        var areta = segments.Where(s => s.TaskId == 194).ToList();

        Assert.NotEmpty(areta);
        Assert.All(areta, s => Assert.Equal(2, s.MaxDepth));
    }

    [Fact]
    public void TwoIntervals_onlyFirstOverlaps_bothUseHalfHeight()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        {
            (Monday.AddHours(10), Monday.AddHours(11), 1, "A", "", "a.cdr", false, "Начал", false),
            (Monday.AddHours(15), Monday.AddHours(16), 1, "A", "", "a.cdr", false, "Продолжил", false),
            (Monday.AddHours(10).AddMinutes(30), Monday.AddHours(11).AddMinutes(30), 2, "B", "", "b.cdr", false, "Начал", false)
        };

        var weekIntervals = intervals.Select(i => (i.start, i.end, i.taskId)).ToList();
        var (layerByTask, maxDepthByTask) = CalendarWeeklyLayout.ComputeWeeklyLayoutForTasks(weekIntervals);

        var segments = CalendarDayWorkLayout.BuildWorkSegments(intervals, layerByTask, maxDepthByTask);
        var taskA = segments.Where(s => s.TaskId == 1).ToList();

        Assert.Equal(2, taskA.Count);
        Assert.All(taskA, s => Assert.Equal(2, s.MaxDepth));
    }

    [Fact]
    public void SingleTask_allSegmentsMaxDepthOne()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        {
            (Monday.AddHours(10), Monday.AddHours(14), 1, "Solo", "", "a.cdr", false, "Начал", false)
        };

        var segments = CalendarDayWorkLayout.BuildWorkSegments(
            intervals,
            new Dictionary<int, int> { [1] = 0 },
            new Dictionary<int, int> { [1] = 1 });

        Assert.All(segments, s => Assert.Equal(1, s.MaxDepth));
    }
}
