namespace ProductionPlanner.Services.Calendar;

/// <summary>
/// Глобальная раскладка слоёв и глубины полос фактической работы на неделе.
/// Высота полосы задачи = 100% / maxDepth, где maxDepth — пик одновременных задач,
/// пока задача активна (если хотя бы один интервал пересёкся с другой — все интервалы
/// задачи рисуются с той же долей высоты, в т.ч. после обеда и на следующий день).
/// </summary>
public static class CalendarWeeklyLayout
{
    /// <summary>
    /// 1) <c>layerByTask</c> — стабильный ряд (0, 1, …) для задачи на всю неделю.
    /// 2) <c>maxDepthByTask</c> — максимум одновременных задач, пока задача активна;
    ///    высота полосы = 100% / maxDepth (2 задачи → 50%, 3 → 33% и т.д.).
    /// Интервалы полуоткрытые [start, end): при стыке конец→начало в одну секунду параллели нет.
    /// </summary>
    public static (Dictionary<int, int> LayerByTask, Dictionary<int, int> MaxDepthByTask)
        ComputeWeeklyLayoutForTasks(List<(DateTime start, DateTime end, int taskId)> intervals)
    {
        var layerByTask = new Dictionary<int, int>();
        var maxDepthByTask = new Dictionary<int, int>();

        if (intervals.Count == 0)
            return (layerByTask, maxDepthByTask);

        var tasksByFirstAppearance = intervals
            .GroupBy(i => i.taskId)
            .OrderBy(g => g.Min(i => i.start))
            .ToList();

        var intervalsByLayer = new Dictionary<int, List<(DateTime start, DateTime end)>>();
        foreach (var group in tasksByFirstAppearance)
        {
            var taskId = group.Key;
            var taskIntervals = group.Select(i => (i.start, i.end)).ToList();

            var layer = 0;
            while (true)
            {
                if (!intervalsByLayer.TryGetValue(layer, out var existing))
                {
                    intervalsByLayer[layer] = new List<(DateTime, DateTime)>(taskIntervals);
                    break;
                }

                var conflicts = taskIntervals.Any(ti =>
                    existing.Any(ei => ti.start < ei.end && ti.end > ei.start));
                if (!conflicts)
                {
                    existing.AddRange(taskIntervals);
                    break;
                }

                layer++;
            }

            layerByTask[taskId] = layer;
            maxDepthByTask[taskId] = 1;
        }

        var events = new List<(DateTime time, int type, int taskId)>(intervals.Count * 2);
        foreach (var iv in intervals)
        {
            events.Add((iv.start, 1, iv.taskId));
            events.Add((iv.end, -1, iv.taskId));
        }

        events = events
            .OrderBy(e => e.time)
            .ThenBy(e => e.type == -1 ? 0 : 1)
            .ToList();

        var refCountByTask = new Dictionary<int, int>();
        foreach (var ev in events)
        {
            if (ev.type == 1)
            {
                refCountByTask.TryGetValue(ev.taskId, out var count);
                refCountByTask[ev.taskId] = count + 1;
            }
            else
            {
                refCountByTask[ev.taskId] = refCountByTask[ev.taskId] - 1;
                if (refCountByTask[ev.taskId] <= 0)
                    refCountByTask.Remove(ev.taskId);
            }

            var distinctTasks = refCountByTask.Count;
            if (distinctTasks == 0) continue;

            foreach (var activeTaskId in refCountByTask.Keys.ToList())
            {
                if (!maxDepthByTask.TryGetValue(activeTaskId, out var current))
                    current = 1;
                maxDepthByTask[activeTaskId] = Math.Max(current, distinctTasks);
            }
        }

        foreach (var kvp in layerByTask)
        {
            var taskId = kvp.Key;
            var layer = kvp.Value;
            if (!maxDepthByTask.TryGetValue(taskId, out var depth) || layer >= depth)
                maxDepthByTask[taskId] = Math.Max(depth, layer + 1);
        }

        return (layerByTask, maxDepthByTask);
    }
}
