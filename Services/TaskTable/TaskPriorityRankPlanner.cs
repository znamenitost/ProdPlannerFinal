namespace ProductionPlanner.Services.TaskTable;

/// <summary>
/// Очередь 1-2-3 у сотрудника: свободный номер — просто запись,
/// занятый — сдвиг остальных (5→1 поднимает эту задачу, прежние 1–4 едут вниз).
/// JoinWave: занять тот же номер без сдвига (параллельная волна на доске плана).
/// </summary>
public static class TaskPriorityRankPlanner
{
    public const int ExtraFreeSlots = 3;
    public const int MaxRank = 99;

    public readonly record struct RankedTask(int Id, int Rank);

    /// <summary>Следующий свободный номер после самой большой занятой очереди.</summary>
    public static int NextAppendRank(IReadOnlyList<RankedTask> ranked)
    {
        if (ranked == null || ranked.Count == 0) return 1;
        var max = ranked.Max(t => t.Rank);
        return Math.Min(max + 1, MaxRank);
    }

    public static List<int> GetVisibleRanks(IReadOnlyCollection<int> occupiedRanks)
    {
        var maxOccupied = occupiedRanks.Count == 0 ? 0 : occupiedRanks.Max();
        var last = Math.Min(Math.Max(maxOccupied, 0) + ExtraFreeSlots, MaxRank);
        if (last < ExtraFreeSlots)
            last = ExtraFreeSlots;
        return Enumerable.Range(1, last).ToList();
    }

    public static Dictionary<int, int?> PlanAssign(
        IReadOnlyList<RankedTask> ranked,
        int taskId,
        int? currentRank,
        int? targetRank,
        bool joinWave = false)
    {
        var changes = new Dictionary<int, int?>();

        if (targetRank is < 1 or > MaxRank)
            throw new ArgumentOutOfRangeException(nameof(targetRank));

        if (targetRank is null)
        {
            if (currentRank is not null)
                changes[taskId] = null;
            return changes;
        }

        if (joinWave)
        {
            if (currentRank != targetRank)
                changes[taskId] = targetRank;
            return changes;
        }

        var others = ranked.Where(t => t.Id != taskId).ToList();
        var occupiedByOther = others.Any(t => t.Rank == targetRank.Value);

        if (currentRank is null)
        {
            if (occupiedByOther)
            {
                foreach (var task in others.Where(t => t.Rank >= targetRank.Value))
                    changes[task.Id] = task.Rank + 1;
            }

            changes[taskId] = targetRank;
            return changes;
        }

        if (currentRank == targetRank)
            return changes;

        var from = currentRank.Value;
        var to = targetRank.Value;

        if (!occupiedByOther)
        {
            changes[taskId] = to;
            return changes;
        }

        if (from < to)
        {
            foreach (var task in others.Where(t => t.Rank > from && t.Rank <= to))
                changes[task.Id] = task.Rank - 1;
        }
        else
        {
            foreach (var task in others.Where(t => t.Rank >= to && t.Rank < from))
                changes[task.Id] = task.Rank + 1;
        }

        changes[taskId] = to;
        return changes;
    }
}
