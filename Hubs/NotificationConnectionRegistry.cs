using System.Collections.Concurrent;

namespace ProductionPlanner.Hubs;

/// <summary>
/// Учёт активных SignalR-подключений по пользователю; лишние закрываются при новом входе.
/// </summary>
public sealed class NotificationConnectionRegistry
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _byUser = new();

    public int MaxConnectionsPerUser { get; init; } = 3;

    public IReadOnlyList<string> Register(string userId, string connectionId)
    {
        var connections = _byUser.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
        connections[connectionId] = 0;

        var toClose = new List<string>();
        while (connections.Count > MaxConnectionsPerUser)
        {
            var victim = connections.Keys.FirstOrDefault(id => id != connectionId);
            if (victim == null)
                break;
            if (connections.TryRemove(victim, out _))
                toClose.Add(victim);
        }

        return toClose;
    }

    public void Unregister(string userId, string connectionId)
    {
        if (!_byUser.TryGetValue(userId, out var connections))
            return;

        connections.TryRemove(connectionId, out _);
        if (connections.IsEmpty)
            _byUser.TryRemove(userId, out _);
    }

    public int CountForUser(string userId) =>
        _byUser.TryGetValue(userId, out var connections) ? connections.Count : 0;
}
