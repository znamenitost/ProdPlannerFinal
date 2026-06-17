using ProductionPlanner.Models.Dtos.Calendar;

namespace ProductionPlanner.Services.Calendar;

/// <summary>
/// Разбивает дневные интервалы работы на отрезки. Высота полосы (maxDepth) — глобальная
/// для задачи на неделю: если хотя бы один интервал пересёкся с другой задачей, все
/// интервалы этой задачи рисуются с той же долей высоты (100% / maxDepth).
/// </summary>
public static class CalendarDayWorkLayout
{
    public static List<CalendarTimelineSegmentDto> BuildWorkSegments(
        List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)> intervalsForDay,
        IReadOnlyDictionary<int, int> layerByTask,
        IReadOnlyDictionary<int, int> maxDepthByTask)
    {
        if (intervalsForDay.Count == 0)
            return new List<CalendarTimelineSegmentDto>();

        var boundaries = new SortedSet<DateTime>();
        foreach (var iv in intervalsForDay)
        {
            boundaries.Add(iv.start);
            boundaries.Add(iv.end);
        }

        var times = boundaries.ToList();
        var slices = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth)>();

        for (var i = 0; i < times.Count - 1; i++)
        {
            var sliceStart = times[i];
            var sliceEnd = times[i + 1];
            if (sliceStart >= sliceEnd)
                continue;

            var active = intervalsForDay
                .Where(iv => iv.start < sliceEnd && iv.end > sliceStart)
                .ToList();
            if (active.Count == 0)
                continue;

            foreach (var iv in active)
            {
                var layer = layerByTask.TryGetValue(iv.taskId, out var l) ? l : 0;
                var depth = maxDepthByTask.TryGetValue(iv.taskId, out var d) ? d : 1;
                slices.Add((sliceStart, sliceEnd, iv.taskId, iv.taskTitle, iv.folderPath, iv.fileName, iv.completed, iv.statusText, iv.isOpenInterval, layer, depth));
            }
        }

        return MergeAdjacentSlices(slices);
    }

    private static List<CalendarTimelineSegmentDto> MergeAdjacentSlices(
        List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth)> slices)
    {
        if (slices.Count == 0)
            return new List<CalendarTimelineSegmentDto>();

        var merged = new List<CalendarTimelineSegmentDto>();
        var current = slices[0];

        for (var i = 1; i < slices.Count; i++)
        {
            var next = slices[i];
            if (CanMerge(current, next))
            {
                current = (current.start, next.end, current.taskId, current.taskTitle, current.folderPath, current.fileName, current.completed, current.statusText, current.isOpenInterval, current.layer, current.maxDepth);
                continue;
            }

            merged.Add(ToDto(current));
            current = next;
        }

        merged.Add(ToDto(current));
        return merged;
    }

    private static bool CanMerge(
        (DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth) a,
        (DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth) b) =>
        a.taskId == b.taskId
        && a.end == b.start
        && a.layer == b.layer
        && a.maxDepth == b.maxDepth
        && a.completed == b.completed
        && a.statusText == b.statusText
        && a.isOpenInterval == b.isOpenInterval
        && a.taskTitle == b.taskTitle
        && a.folderPath == b.folderPath
        && a.fileName == b.fileName;

    private static CalendarTimelineSegmentDto ToDto(
        (DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth) slice) =>
        new()
        {
            Start = slice.start,
            End = slice.end,
            Type = "work",
            TaskId = slice.taskId,
            TaskTitle = slice.taskTitle,
            FolderPath = slice.folderPath,
            FileName = slice.fileName,
            Completed = slice.completed,
            StatusText = slice.statusText,
            Layer = slice.layer,
            MaxDepth = Math.Max(1, slice.maxDepth),
            IsOpenInterval = slice.isOpenInterval
        };
}
