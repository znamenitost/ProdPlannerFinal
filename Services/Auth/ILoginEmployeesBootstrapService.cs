namespace ProductionPlanner.Services.Auth;

public interface ILoginEmployeesBootstrapService
{
    string GetBootstrapJson();
    Task RefreshAsync(CancellationToken cancellationToken = default);
}
