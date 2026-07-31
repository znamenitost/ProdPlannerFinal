using System.Collections.Concurrent;

namespace ProductionPlanner.Services.Catalog;

/// <summary>
/// In-memory store for background-removal jobs. The removal endpoint returns
/// a job id immediately; the client polls status until done. ORT inference is
/// a single blocking call, so percent is stage-based with time interpolation.
/// Jobs are single-process state: an app-pool recycle loses them and the
/// client is told to retry.
/// </summary>
public sealed class BackgroundRemovalJobStore
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(15);

    public sealed record State(double Percent, string Stage, bool Done, string? Error, string? ImageDataUrl);

    private sealed class Entry
    {
        public required State State { get; set; }
        public required DateTimeOffset CreatedAt { get; init; }
    }

    private readonly ConcurrentDictionary<Guid, Entry> _jobs = new();
    private long _lastCleanupTicks = DateTimeOffset.UtcNow.Ticks;

    public Guid Create()
    {
        CleanupIfDue();
        var id = Guid.NewGuid();
        _jobs[id] = new Entry
        {
            State = new State(0, "В очереди", false, null, null),
            CreatedAt = DateTimeOffset.UtcNow
        };
        return id;
    }

    public void Report(Guid id, double percent, string stage)
    {
        if (_jobs.TryGetValue(id, out var entry) && !entry.State.Done)
            entry.State = entry.State with { Percent = Math.Round(percent, 1), Stage = stage };
    }

    public void Complete(Guid id, string imageDataUrl)
    {
        if (_jobs.TryGetValue(id, out var entry))
            entry.State = new State(100, "Готово", true, null, imageDataUrl);
    }

    public void Fail(Guid id, string error)
    {
        if (_jobs.TryGetValue(id, out var entry))
            entry.State = new State(entry.State.Percent, entry.State.Stage, true, error, null);
    }

    public State? Get(Guid id)
        => _jobs.TryGetValue(id, out var entry) ? entry.State : null;

    private void CleanupIfDue()
    {
        var now = DateTimeOffset.UtcNow;
        var last = Interlocked.Read(ref _lastCleanupTicks);
        if (now.Ticks - last < TimeSpan.TicksPerMinute)
            return;
        if (Interlocked.CompareExchange(ref _lastCleanupTicks, now.Ticks, last) != last)
            return;

        foreach (var (id, entry) in _jobs)
        {
            if (now - entry.CreatedAt > Ttl)
                _jobs.TryRemove(id, out _);
        }
    }
}
