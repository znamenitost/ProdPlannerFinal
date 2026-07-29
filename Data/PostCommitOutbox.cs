namespace ProductionPlanner.Data;

/// <summary>
/// Outbox для побочных эффектов (SignalR / web push / внешние мессенджеры), которые
/// должны срабатывать только после фиксации транзакции БД. Пока активна транзакция,
/// действия накапливаются и выполняются после commit в порядке постановки; при
/// rollback или повторной попытке execution strategy scope отбрасывается целиком.
/// Без активной транзакции действия выполняются немедленно — поведение как раньше.
/// </summary>
public sealed class PostCommitOutbox
{
    private sealed class Scope
    {
        public List<Func<Task>> Actions { get; } = [];
    }

    private sealed class ScopeRegistration : IDisposable
    {
        private readonly Scope? _previous;
        private bool _disposed;

        public ScopeRegistration(Scope? previous) => _previous = previous;

        public void Dispose()
        {
            if (_disposed)
                return;
            _disposed = true;
            Current.Value = _previous;
        }
    }

    private static readonly AsyncLocal<Scope?> Current = new();

    private readonly ILogger<PostCommitOutbox> _logger;

    public PostCommitOutbox(ILogger<PostCommitOutbox> logger) => _logger = logger;

    /// <summary>Активна ли транзакционная область накопления.</summary>
    public bool IsActive => Current.Value != null;

    /// <summary>
    /// При активной транзакции откладывает действие до commit, иначе выполняет немедленно.
    /// </summary>
    public Task EnqueueOrRunAsync(Func<Task> action)
    {
        var scope = Current.Value;
        if (scope == null)
            return action();

        scope.Actions.Add(action);
        return Task.CompletedTask;
    }

    /// <summary>Открывает область накопления на время одной попытки транзакции.</summary>
    public IDisposable BeginScope()
    {
        var previous = Current.Value;
        Current.Value = new Scope();
        return new ScopeRegistration(previous);
    }

    /// <summary>
    /// Выполняет накопленные действия после commit. Ошибки отдельных действий логируются
    /// и не прерывают остальные: данные уже зафиксированы, уведомления — best effort.
    /// </summary>
    public async Task FlushAsync()
    {
        var scope = Current.Value;
        if (scope == null || scope.Actions.Count == 0)
            return;

        foreach (var action in scope.Actions)
        {
            try
            {
                await action();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Post-commit notification failed");
            }
        }

        scope.Actions.Clear();
    }
}
