using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using ProductionPlanner.Hubs;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

public interface ITaskDataSyncHubBroadcaster
{
    Task BroadcastAsync(string method, string[] affectedEmployees, params object?[] args);

    void ScheduleProgressChanged(ProductionTask task, double progress, string[] affectedEmployees);
}

/// <summary>
/// Data-sync: table-viewers (общая таблица) + calendar-viewers:{имя} (календарь конкретного сотрудника).
/// </summary>
public sealed class TaskDataSyncHubBroadcaster : ITaskDataSyncHubBroadcaster, IDisposable
{
    private const int ProgressDebounceMs = 300;

    private static readonly HashSet<string> TableSyncMethods = new(StringComparer.Ordinal)
    {
        "TaskUpdated",
        "TaskDeleted",
        "TaskStatusChanged"
    };

    private static readonly HashSet<string> CalendarSyncMethods = new(StringComparer.Ordinal)
    {
        "TaskUpdated",
        "TaskDeleted",
        "TaskStatusChanged",
        "TaskProgressChanged"
    };

    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<TaskDataSyncHubBroadcaster> _logger;
    private readonly ConcurrentDictionary<int, ProgressDebounceEntry> _progressEntries = new();

    public TaskDataSyncHubBroadcaster(
        IHubContext<NotificationHub> hubContext,
        ILogger<TaskDataSyncHubBroadcaster> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public Task BroadcastAsync(string method, string[] affectedEmployees, params object?[] args)
    {
        var groups = ResolveGroups(method, affectedEmployees);
        if (groups.Count == 0)
            return Task.CompletedTask;

        return _hubContext.Clients.Groups(groups).SendCoreAsync(method, args);
    }

    public void ScheduleProgressChanged(ProductionTask task, double progress, string[] affectedEmployees)
    {
        var entry = _progressEntries.GetOrAdd(task.Id, _ => new ProgressDebounceEntry { TaskId = task.Id });

        lock (entry.Sync)
        {
            entry.LatestProgress = progress;
            entry.AffectedEmployees = affectedEmployees;
            entry.Timer?.Dispose();
            entry.Timer = new Timer(
                _ => _ = FlushProgressAsync(entry),
                null,
                ProgressDebounceMs,
                Timeout.Infinite);
        }
    }

    public void Dispose()
    {
        foreach (var entry in _progressEntries.Values)
        {
            lock (entry.Sync)
            {
                entry.Timer?.Dispose();
                entry.Timer = null;
            }
        }

        _progressEntries.Clear();
    }

    private async Task FlushProgressAsync(ProgressDebounceEntry entry)
    {
        double progress;
        string[] affectedEmployees;
        int taskId;

        lock (entry.Sync)
        {
            progress = entry.LatestProgress;
            affectedEmployees = entry.AffectedEmployees;
            taskId = entry.TaskId;
            entry.Timer?.Dispose();
            entry.Timer = null;
        }

        _progressEntries.TryRemove(taskId, out _);

        try
        {
            await BroadcastAsync(
                "TaskProgressChanged",
                affectedEmployees,
                taskId,
                progress,
                affectedEmployees);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Debounced TaskProgressChanged broadcast failed for task {TaskId}", taskId);
        }
    }

    public static IReadOnlyList<string> ResolveGroups(string method, string[] affectedEmployees)
    {
        var groups = new HashSet<string>(StringComparer.Ordinal);

        if (TableSyncMethods.Contains(method))
            groups.Add(NotificationGroups.TableViewers);

        if (CalendarSyncMethods.Contains(method))
        {
            foreach (var name in affectedEmployees)
            {
                if (string.IsNullOrWhiteSpace(name))
                    continue;

                groups.Add(NotificationGroups.ForCalendarViewer(name));
            }
        }

        return groups.ToList();
    }

    private sealed class ProgressDebounceEntry
    {
        public object Sync { get; } = new();
        public int TaskId { get; init; }
        public double LatestProgress { get; set; }
        public string[] AffectedEmployees { get; set; } = [];
        public Timer? Timer { get; set; }
    }
}
