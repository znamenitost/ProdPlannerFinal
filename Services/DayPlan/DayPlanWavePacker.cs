namespace ProductionPlanner.Services.DayPlan;

/// <summary>
/// Раскладка очереди сотрудника по волнам: одинаковый rank — параллельно,
/// больший rank — после самой длинной задачи предыдущей волны.
/// Не меняет ProductionScheduler (календарный план по дедлайнам).
/// </summary>
public static class DayPlanWavePacker
{
    public const double MinRemainingHours = 0.01;

    public readonly record struct InputTask(int Id, int Rank, double RemainingHours);

    public sealed class PackedTask
    {
        public int TaskId { get; init; }
        public int Rank { get; init; }
        public int Lane { get; init; }
        public int LaneCount { get; init; }
        public IReadOnlyList<WorkTimeSegment> Segments { get; init; } = [];
    }

    public static List<PackedTask> Pack(
        IReadOnlyList<InputTask> tasks,
        DateTime cursorStart,
        IWorkHoursCalculator workHours)
    {
        var result = new List<PackedTask>();
        var waves = tasks
            .Where(t => t.Rank > 0 && t.RemainingHours >= MinRemainingHours)
            .GroupBy(t => t.Rank)
            .OrderBy(g => g.Key)
            .Select(g => g.OrderBy(t => t.Id).ToList())
            .ToList();

        var cursor = workHours.GetNextWorkStart(cursorStart);

        foreach (var wave in waves)
        {
            var laneCount = wave.Count;
            var maxHours = wave.Max(t => t.RemainingHours);

            for (var lane = 0; lane < wave.Count; lane++)
            {
                var task = wave[lane];
                result.Add(new PackedTask
                {
                    TaskId = task.Id,
                    Rank = task.Rank,
                    Lane = lane,
                    LaneCount = laneCount,
                    Segments = workHours.AllocateWorkTime(cursor, task.RemainingHours)
                });
            }

            cursor = workHours.AddWorkHours(cursor, maxHours);
        }

        return result;
    }
}
