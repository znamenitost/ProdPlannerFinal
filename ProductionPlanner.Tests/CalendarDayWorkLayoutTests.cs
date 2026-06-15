using ProductionPlanner.Services.Calendar;

namespace ProductionPlanner.Tests;

public class CalendarDayWorkLayoutTests
{
    private static readonly DateTime Monday = new(2026, 6, 15, 0, 0, 0, DateTimeKind.Unspecified);

    [Fact]
    public void ShortOverlap_splitsDepth_onlyDuringOverlap()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        {
            (Monday.AddHours(17).AddMinutes(15).AddSeconds(35), Monday.AddHours(19), 194, "Арета", "", "medals.cdr", false, "Пауза", false),
            (Monday.AddHours(18).AddMinutes(14).AddSeconds(59.418545), Monday.AddHours(18).AddMinutes(15).AddSeconds(1.011406), 201, "ИП Саксин", "", "cakes", true, "Готово", false)
        };

        var layerByTask = new Dictionary<int, int> { [194] = 0, [201] = 1 };

        var segments = CalendarDayWorkLayout.BuildWorkSegments(intervals, layerByTask);
        var areta = segments.Where(s => s.TaskId == 194).ToList();

        Assert.Contains(areta, s => s.MaxDepth == 1 && (s.End - s.Start).TotalMinutes > 30);
        Assert.Contains(areta, s => s.MaxDepth == 2);
        Assert.True(areta.Where(s => s.MaxDepth == 2).Sum(s => (s.End - s.Start).TotalSeconds) < 5);
    }

    [Fact]
    public void SingleTask_allSegmentsMaxDepthOne()
    {
        var intervals = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        {
            (Monday.AddHours(10), Monday.AddHours(14), 1, "Solo", "", "a.cdr", false, "Начал", false)
        };

        var segments = CalendarDayWorkLayout.BuildWorkSegments(intervals, new Dictionary<int, int> { [1] = 0 });

        Assert.All(segments, s => Assert.Equal(1, s.MaxDepth));
    }
}
