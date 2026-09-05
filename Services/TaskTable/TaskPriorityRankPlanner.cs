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

    public readonly record struct RankedTask(int Id, int Rank, int Order = 0);

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

    public static List<RankedTask> ProjectRanks(
        IReadOnlyList<RankedTask> ranked,
        IReadOnlyDictionary<int, int?> rankChanges,
        int taskId,
        int? fallbackRank)
    {
        var byId = new Dictionary<int, RankedTask>();
        if (ranked != null)
        {
            foreach (var task in ranked)
                byId[task.Id] = task;
        }

        if (rankChanges != null)
        {
            foreach (var change in rankChanges)
            {
                if (change.Value is > 0)
                {
                    var order = byId.TryGetValue(change.Key, out var prev) ? prev.Order : int.MaxValue;
                    byId[change.Key] = new RankedTask(change.Key, change.Value.Value, order);
                }
                else
                {
                    byId.Remove(change.Key);
                }
            }
        }

        if (!byId.ContainsKey(taskId) && fallbackRank is > 0)
            byId[taskId] = new RankedTask(taskId, fallbackRank.Value, int.MaxValue);

        return byId.Values.ToList();
    }

    /// <summary>
    /// Поставить задачу сразу до/после целевой в её волне.
    /// Rank целевой волны уже должен быть проставлен в <paramref name="ranked"/>.
    /// </summary>
    public static Dictionary<int, int> PlanPlaceInWave(
        IReadOnlyList<RankedTask> ranked,
        int taskId,
        int targetTaskId,
        bool before)
    {
        var changes = new Dictionary<int, int>();
        if (taskId == targetTaskId) return changes;

        var list = ranked ?? [];
        RankedTask? target = null;
        RankedTask? moving = null;
        foreach (var task in list)
        {
            if (task.Id == targetTaskId) target = task;
            if (task.Id == taskId) moving = task;
        }

        if (target is null) return changes;

        var rank = target.Value.Rank;
        var wave = list
            .Where(t => t.Rank == rank && t.Id != taskId)
            .OrderBy(t => t.Order)
            .ThenBy(t => t.Id)
            .ToList();
        var targetIndex = wave.FindIndex(t => t.Id == targetTaskId);
        if (targetIndex < 0) return changes;

        var insertAt = before ? targetIndex : targetIndex + 1;
        var movingTask = moving is { } current
            ? new RankedTask(taskId, rank, current.Order)
            : new RankedTask(taskId, rank, int.MaxValue);
        wave.Insert(insertAt, movingTask);

        for (var i = 0; i < wave.Count; i++)
        {
            if (wave[i].Order != i)
                changes[wave[i].Id] = i;
        }

        if (moving is { } left && left.Rank != rank)
        {
            foreach (var pair in CompactWaveOrders(list, left.Rank, taskId))
                changes[pair.Key] = pair.Value;
        }

        return changes;
    }

    public static Dictionary<int, int> PlanAppendToWave(
        IReadOnlyList<RankedTask> ranked,
        int taskId,
        int rank)
    {
        var wave = (ranked ?? [])
            .Where(t => t.Rank == rank && t.Id != taskId)
            .OrderBy(t => t.Order)
            .ThenBy(t => t.Id)
            .ToList();
        var changes = new Dictionary<int, int>();
        for (var i = 0; i < wave.Count; i++)
        {
            if (wave[i].Order != i)
                changes[wave[i].Id] = i;
        }

        var next = wave.Count;
        changes[taskId] = next;

        return changes;
    }

    public static Dictionary<int, int> CompactWaveOrders(
        IReadOnlyList<RankedTask> ranked,
        int rank,
        int? excludeTaskId = null)
    {
        var wave = (ranked ?? [])
            .Where(t => t.Rank == rank && t.Id != excludeTaskId)
            .OrderBy(t => t.Order)
            .ThenBy(t => t.Id)
            .ToList();
        var changes = new Dictionary<int, int>();
        for (var i = 0; i < wave.Count; i++)
        {
            if (wave[i].Order != i)
                changes[wave[i].Id] = i;
        }

        return changes;
    }
}
