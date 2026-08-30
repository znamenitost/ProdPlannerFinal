namespace ProductionPlanner.Services.TaskTable;

/// <summary>
/// Очередь 1-2-3 у сотрудника: свободный номер — просто запись,
/// занятый — сдвиг остальных (5→1 поднимает эту задачу, прежние 1–4 едут вниз).
/// JoinWave: занять тот же номер без сдвига (параллельная волна на доске плана).
/// После любого назначения номера сжимаются в 1..N без дыр — верх доски всегда волна 1.
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
            return MergeCompact(ranked, changes);
        }

        if (joinWave)
        {
            if (currentRank != targetRank)
                changes[taskId] = targetRank;
            return MergeCompact(ranked, changes);
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
            return MergeCompact(ranked, changes);
        }

        if (currentRank == targetRank)
            return MergeCompact(ranked, changes);

        var from = currentRank.Value;
        var to = targetRank.Value;

        if (!occupiedByOther)
        {
            changes[taskId] = to;
            return MergeCompact(ranked, changes);
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
        return MergeCompact(ranked, changes);
    }

    /// <summary>Занятые номера 2,3,4 → 1,2,3. Одинаковый rank остаётся параллельной волной.</summary>
    public static Dictionary<int, int?> CompactRanks(IReadOnlyList<RankedTask> ranked)
    {
        var changes = new Dictionary<int, int?>();
        if (ranked == null || ranked.Count == 0)
            return changes;

        var distinct = ranked
            .Where(t => t.Rank > 0)
            .Select(t => t.Rank)
            .Distinct()
            .OrderBy(r => r)
            .ToList();

        var map = new Dictionary<int, int>(distinct.Count);
        for (var i = 0; i < distinct.Count; i++)
            map[distinct[i]] = i + 1;

        foreach (var task in ranked)
        {
            if (task.Rank > 0 && map.TryGetValue(task.Rank, out var next) && next != task.Rank)
                changes[task.Id] = next;
        }

        return changes;
    }

    static Dictionary<int, int?> MergeCompact(
        IReadOnlyList<RankedTask> ranked,
        Dictionary<int, int?> changes)
    {
        var projected = new Dictionary<int, int?>();
        if (ranked != null)
        {
            foreach (var task in ranked)
                projected[task.Id] = task.Rank;
        }

        foreach (var change in changes)
            projected[change.Key] = change.Value;

        var remaining = projected
            .Where(pair => pair.Value is > 0)
            .Select(pair => new RankedTask(pair.Key, pair.Value!.Value))
            .ToList();

        foreach (var compact in CompactRanks(remaining))
            changes[compact.Key] = compact.Value;

        return changes;
    }
}
