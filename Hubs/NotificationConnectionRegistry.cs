using System.Collections.Concurrent;

namespace ProductionPlanner.Hubs;

public sealed record ConnectionRegistrySnapshot(
    int ActiveTotal,
    long TotalOpened,
    long TotalClosed,
    int UsersOnline,
    IReadOnlyDictionary<string, int> ByUser,
    int MaxConnectionsPerUser)
{
    public long Balance => TotalOpened - TotalClosed - ActiveTotal;
}

/// <summary>
/// Учёт активных SignalR-подключений по пользователю; лишние закрываются при новом входе.
/// </summary>
public sealed class NotificationConnectionRegistry
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _byUser = new();
    private long _totalOpened;
    private long _totalClosed;

    public int MaxConnectionsPerUser { get; init; } = 3;

    public IReadOnlyList<string> Register(string userId, string connectionId)
    {
        var connections = _byUser.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
        var isNew = !connections.ContainsKey(connectionId);
        connections[connectionId] = 0;
        if (isNew)
            Interlocked.Increment(ref _totalOpened);

        var toClose = new List<string>();
        while (connections.Count > MaxConnectionsPerUser)
        {
            var victim = connections.Keys.ToList().FirstOrDefault(id => id != connectionId);
            if (victim == null)
                break;
            if (connections.TryRemove(victim, out _))
            {
                toClose.Add(victim);
                Interlocked.Increment(ref _totalClosed);
            }
        }

        return toClose;
    }

    public void Unregister(string userId, string connectionId)
    {
        if (!_byUser.TryGetValue(userId, out var connections))
            return;

        if (connections.TryRemove(connectionId, out _))
            Interlocked.Increment(ref _totalClosed);

        if (connections.IsEmpty)
            _byUser.TryRemove(userId, out _);
    }

    public int CountForUser(string userId) =>
        _byUser.TryGetValue(userId, out var connections) ? connections.Count : 0;

    public ConnectionRegistrySnapshot GetSnapshot()
    {
        var byUser = _byUser.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.Count,
            StringComparer.Ordinal);

        var activeTotal = byUser.Values.Sum();
        return new ConnectionRegistrySnapshot(
            activeTotal,
            Interlocked.Read(ref _totalOpened),
            Interlocked.Read(ref _totalClosed),
            byUser.Count,
            byUser,
            MaxConnectionsPerUser);
    }
}
