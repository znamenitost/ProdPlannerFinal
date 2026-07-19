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
/// </summary>
public sealed class TaskTypeStatsService : ITaskTypeStatsService
{
    private const string EmptyTypeLabel = "Без типа";

    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _time;

    public TaskTypeStatsService(ApplicationDbContext db, IAppTimeService time)
    {
        _db = db;
        _time = time;
    }

    public async Task<TaskTypeStatsDto> GetCompletedLeafStatsAsync(CancellationToken cancellationToken = default)
    {
        var raw = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.Status == JobStatus.Completed
                        && !(t.IsSplitTask && t.ParentRowNumber == null))
            .GroupBy(t => t.Type)
            .Select(g => new
            {
                Type = g.Key,
                TaskCount = g.Count(),
                TotalActualHours = g.Sum(t => t.ActualHours)
            })
            .ToListAsync(cancellationToken);

        var rows = raw
            .GroupBy(r => string.IsNullOrWhiteSpace(r.Type) ? EmptyTypeLabel : r.Type.Trim())
            .Select(g => new TaskTypeBucketDto
            {
                Type = g.Key,
                TaskCount = g.Sum(x => x.TaskCount),
                TotalActualHours = g.Sum(x => x.TotalActualHours)
            })
            .OrderByDescending(r => r.TaskCount)
            .ThenByDescending(r => r.TotalActualHours)
            .ThenBy(r => r.Type, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new TaskTypeStatsDto
        {
            CalculatedAt = _time.Now,
            TotalTasks = rows.Sum(r => r.TaskCount),
            TotalActualHours = rows.Sum(r => r.TotalActualHours),
            Items = rows
        };
    }
}
