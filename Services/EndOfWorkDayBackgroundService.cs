using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

/// <summary>
/// В 19:00 (московское, пн–пт) закрывает все открытые интервалы, ставит задачи «В работе» на паузу
/// и закрывает незавершённые обеды (задачи после обеда остаются на паузе).
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
        await CloseOpenLunchesAtEndOfDayAsync(scope.ServiceProvider, workDayEnd, cancellationToken);
    }

    private async Task CloseOpenLunchesAtEndOfDayAsync(
        IServiceProvider services,
        DateTime workDayEnd,
        CancellationToken cancellationToken)
    {
        var repo = services.GetRequiredService<IProductionTaskRepository>();
        var dataSync = services.GetRequiredService<ITaskDataSyncHubBroadcaster>();
        var hubContext = services.GetRequiredService<IHubContext<NotificationHub>>();
        var userManager = services.GetRequiredService<UserManager<User>>();

        var employees = await repo.CloseAllOpenLunchIntervalsAsync(workDayEnd, cancellationToken);
        if (employees.Count == 0)
            return;

        _logger.LogInformation(
            "Автозакрытие обеда в конце дня для {Count} сотрудников: {Names}",
            employees.Count,
            string.Join(", ", employees));

        foreach (var employeeName in employees)
        {
            await dataSync.BroadcastAsync(
                "LunchStateChanged",
                [employeeName],
                employeeName,
                null);

            var user = await userManager.Users.FirstOrDefaultAsync(
                u => u.FullName == employeeName,
                cancellationToken);
            if (user == null)
                continue;

            await hubContext.Clients.Group(user.Id).SendAsync(
                "LunchStateChanged",
                employeeName,
                null,
                cancellationToken);
        }
    }
}
