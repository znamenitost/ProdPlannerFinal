using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public interface ITaskTypeStatsService
{
    Task<TaskTypeStatsDto> GetCompletedLeafStatsAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// On-demand снимок: завершённые листовые задачи (дети сплитов + несплитнутые) по всей БД.
/// Тип может храниться как "A, B" (склейка на родителе/legacy) — считаем по атомарным типам.
/// </summary>
public sealed class TaskTypeStatsService : ITaskTypeStatsService
{
    private const string EmptyTypeLabel = "Без типа";
    private static readonly char[] TypeSeparators = [','];

    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _time;

    public TaskTypeStatsService(ApplicationDbContext db, IAppTimeService time)
    {
        _db = db;
        _time = time;
    }

    public async Task<TaskTypeStatsDto> GetCompletedLeafStatsAsync(CancellationToken cancellationToken = default)
    {
        var leaves = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.Status == JobStatus.Completed
                        && !(t.IsSplitTask && t.ParentRowNumber == null))
            .Select(t => new { t.Type, t.ActualHours })
            .ToListAsync(cancellationToken);

        var buckets = new Dictionary<string, TaskTypeBucketDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var leaf in leaves)
        {
            var types = ParseAtomicTypes(leaf.Type);
            var hoursShare = types.Count > 0 ? leaf.ActualHours / types.Count : 0;

            foreach (var type in types)
            {
                if (!buckets.TryGetValue(type, out var bucket))
                {
                    bucket = new TaskTypeBucketDto { Type = type };
                    buckets[type] = bucket;
                }

                bucket.TaskCount += 1;
                bucket.TotalActualHours += hoursShare;
            }
        }

        var rows = buckets.Values
            .OrderByDescending(r => r.TaskCount)
            .ThenByDescending(r => r.TotalActualHours)
            .ThenBy(r => r.Type, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new TaskTypeStatsDto
        {
            CalculatedAt = _time.Now,
            TotalTasks = leaves.Count,
            TotalActualHours = leaves.Sum(t => t.ActualHours),
            Items = rows
        };
    }

    /// <summary>
    /// "Резка, УФ Печать" → ["Резка", "УФ Печать"]; пустая/whitespace → ["Без типа"].
    /// </summary>
    private static List<string> ParseAtomicTypes(string? rawType)
    {
        if (string.IsNullOrWhiteSpace(rawType))
            return [EmptyTypeLabel];

        var parts = rawType
            .Split(TypeSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(p => p.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return parts.Count == 0 ? [EmptyTypeLabel] : parts;
    }
}
