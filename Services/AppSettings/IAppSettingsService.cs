namespace ProductionPlanner.Services.AppSettings;

public interface IAppSettingsService
{
    Task<T?> GetJsonAsync<T>(string key, CancellationToken cancellationToken = default)
        where T : class;

    Task SaveJsonAsync<T>(string key, T value, CancellationToken cancellationToken = default)
        where T : class;
}
