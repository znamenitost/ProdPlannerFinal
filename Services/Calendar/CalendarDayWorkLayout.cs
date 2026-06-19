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
                .GroupBy(iv => iv.taskId)
                .Select(g => g.First())
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

        return MergeSlicesPerTask(slices);
    }

    /// <summary>
    /// Склеивает пересекающиеся/стыкующиеся интервалы одной задачи в один отрезок на день,
    /// чтобы дубли или перекрытия в WorkIntervals не рисовали несколько полос в одном месте.
    /// </summary>
    public static List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>
        CoalesceIntervalsPerTask(
            List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)> intervalsForDay)
    {
        if (intervalsForDay.Count == 0)
            return intervalsForDay;

        var result = new List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval)>();

        foreach (var group in intervalsForDay.GroupBy(i => i.taskId))
        {
            var ordered = group.OrderBy(i => i.start).ToList();
            var mergedStart = ordered[0].start;
            var mergedEnd = ordered[0].end;
            var taskId = ordered[0].taskId;
            var taskTitle = ordered[0].taskTitle;
            var folderPath = ordered[0].folderPath;
            var fileName = ordered[0].fileName;
            var completed = ordered[0].completed;
            var statusText = ordered[0].statusText;
            var isOpenInterval = ordered[0].isOpenInterval;

            for (var i = 1; i < ordered.Count; i++)
            {
                var current = ordered[i];
                if (current.start <= mergedEnd)
                {
                    if (current.end > mergedEnd)
                        mergedEnd = current.end;
                    isOpenInterval |= current.isOpenInterval;
                    completed &= current.completed;
                    continue;
                }

                result.Add((mergedStart, mergedEnd, taskId, taskTitle, folderPath, fileName, completed, statusText, isOpenInterval));
                mergedStart = current.start;
                mergedEnd = current.end;
                taskId = current.taskId;
                taskTitle = current.taskTitle;
                folderPath = current.folderPath;
                fileName = current.fileName;
                completed = current.completed;
                statusText = current.statusText;
                isOpenInterval = current.isOpenInterval;
            }

            result.Add((mergedStart, mergedEnd, taskId, taskTitle, folderPath, fileName, completed, statusText, isOpenInterval));
        }

        return result.OrderBy(i => i.start).ToList();
    }

    private static List<CalendarTimelineSegmentDto> MergeSlicesPerTask(
        List<(DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth)> slices)
    {
        if (slices.Count == 0)
            return new List<CalendarTimelineSegmentDto>();

        var result = new List<CalendarTimelineSegmentDto>();

        foreach (var group in slices.GroupBy(s => s.taskId))
        {
            var ordered = group.OrderBy(s => s.start).ToList();
            var current = ordered[0];

            for (var i = 1; i < ordered.Count; i++)
            {
                var next = ordered[i];
                if (CanMergePerTask(current, next))
                {
                    current = (
                        current.start,
                        next.end > current.end ? next.end : current.end,
                        current.taskId,
                        current.taskTitle,
                        current.folderPath,
                        current.fileName,
                        current.completed && next.completed,
                        current.statusText,
                        current.isOpenInterval || next.isOpenInterval,
                        current.layer,
                        current.maxDepth);
                    continue;
                }

                result.Add(ToDto(current));
                current = next;
            }

            result.Add(ToDto(current));
        }

        return result.OrderBy(s => s.Start.Ticks).ToList();
    }

    private static bool CanMergePerTask(
        (DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth) a,
        (DateTime start, DateTime end, int taskId, string taskTitle, string folderPath, string fileName, bool completed, string statusText, bool isOpenInterval, int layer, int maxDepth) b) =>
        a.taskId == b.taskId
        && b.start <= a.end
        && a.layer == b.layer
        && a.maxDepth == b.maxDepth
        && a.statusText == b.statusText
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
