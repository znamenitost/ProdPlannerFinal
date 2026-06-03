namespace ProductionPlanner.Services;

/// <summary>
/// В 19:00 (московское, пн–пт) закрывает все открытые интервалы и ставит задачи «В работе» на паузу.
/// </summary>
public sealed class EndOfWorkDayBackgroundService : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EndOfWorkDayBackgroundService> _logger;

    public EndOfWorkDayBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<EndOfWorkDayBackgroundService> logger)
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
                await TryRunEndOfDayCloseAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Ошибка автозакрытия интервалов в конце рабочего дня");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task TryRunEndOfDayCloseAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var timeService = scope.ServiceProvider.GetRequiredService<IAppTimeService>();
        var lifecycle = scope.ServiceProvider.GetRequiredService<ITaskLifecycleService>();

        var now = timeService.Now;
        if (!EndOfWorkDaySchedule.ShouldRunEndOfDayClose(now))
            return;

        var workDayEnd = EndOfWorkDaySchedule.GetWorkDayEnd(now);
        await lifecycle.PauseOpenTasksAtEndOfWorkDayAsync(workDayEnd, cancellationToken);
    }
}
