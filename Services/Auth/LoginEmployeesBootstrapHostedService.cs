namespace ProductionPlanner.Services.Auth;

public class LoginEmployeesBootstrapHostedService : IHostedService
{
    private readonly ILoginEmployeesBootstrapService _bootstrap;
    private readonly ILogger<LoginEmployeesBootstrapHostedService> _logger;

    public LoginEmployeesBootstrapHostedService(
        ILoginEmployeesBootstrapService bootstrap,
        ILogger<LoginEmployeesBootstrapHostedService> logger)
    {
        _bootstrap = bootstrap;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _bootstrap.RefreshAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Не удалось сгенерировать bootstrap login-employees при старте");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
