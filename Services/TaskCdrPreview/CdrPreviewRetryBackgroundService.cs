namespace ProductionPlanner.Services.TaskCdrPreview;

/// <summary>
/// Раз в минуту оповещает клиентов таблицы о задачах с просроченным временем повторного поиска превью.
/// </summary>
public sealed class CdrPreviewRetryBackgroundService : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CdrPreviewRetryBackgroundService> _logger;

    public CdrPreviewRetryBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<CdrPreviewRetryBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await BroadcastDueRetriesAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Ошибка фоновой рассылки повторного поиска превью CDR");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task BroadcastDueRetriesAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var retryService = scope.ServiceProvider.GetRequiredService<ICdrPreviewRetryService>();
        var dataSync = scope.ServiceProvider.GetRequiredService<ITaskDataSyncHubBroadcaster>();

        var dueTaskIds = await retryService.GetDueTaskIdsAsync(cancellationToken);
        if (dueTaskIds.Count == 0)
            return;

        await dataSync.BroadcastAsync(
            "CdrPreviewRetryDue",
            [],
            dueTaskIds.ToArray());
    }
}
