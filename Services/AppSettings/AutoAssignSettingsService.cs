using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.AppSettings;

public interface IAutoAssignSettingsService
{
    Task<AutoAssignSettingsDto> GetAsync(CancellationToken cancellationToken = default);
    Task SaveAsync(AutoAssignSettingsDto settings, CancellationToken cancellationToken = default);
}

public class AutoAssignSettingsService : IAutoAssignSettingsService
{
    public const string SettingsKey = "auto-assign";

    private readonly IAppSettingsService _appSettings;

    public AutoAssignSettingsService(IAppSettingsService appSettings)
    {
        _appSettings = appSettings;
    }

    public async Task<AutoAssignSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var stored = await _appSettings.GetJsonAsync<AutoAssignSettingsDto>(SettingsKey, cancellationToken);
        return stored ?? new AutoAssignSettingsDto();
    }

    public Task SaveAsync(AutoAssignSettingsDto settings, CancellationToken cancellationToken = default)
    {
        return _appSettings.SaveJsonAsync(SettingsKey, settings, cancellationToken);
    }
}
