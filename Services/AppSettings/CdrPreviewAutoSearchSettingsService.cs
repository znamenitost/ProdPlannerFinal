using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.AppSettings;

public interface ICdrPreviewAutoSearchSettingsService
{
    Task<CdrPreviewAutoSearchSettingsDto> GetAsync(CancellationToken cancellationToken = default);

    Task SaveAsync(CdrPreviewAutoSearchSettingsDto settings, CancellationToken cancellationToken = default);

    Task<int> GetMinutesAsync(CancellationToken cancellationToken = default);
}

public class CdrPreviewAutoSearchSettingsService : ICdrPreviewAutoSearchSettingsService
{
    public const string SettingsKey = "cdr-preview-autosearch";

    /// <summary>Дефолтная задержка второй попытки превью CDR, минут.</summary>
    public const int DefaultMinutes = 1;

    private readonly IAppSettingsService _appSettings;

    public CdrPreviewAutoSearchSettingsService(IAppSettingsService appSettings)
    {
        _appSettings = appSettings;
    }

    public async Task<CdrPreviewAutoSearchSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var stored = await _appSettings.GetJsonAsync<CdrPreviewAutoSearchSettingsDto>(SettingsKey, cancellationToken);
        return Normalize(stored ?? new CdrPreviewAutoSearchSettingsDto());
    }

    public Task SaveAsync(CdrPreviewAutoSearchSettingsDto settings, CancellationToken cancellationToken = default)
    {
        return _appSettings.SaveJsonAsync(SettingsKey, Normalize(settings), cancellationToken);
    }

    public async Task<int> GetMinutesAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetAsync(cancellationToken);
        // UI настройки убран: незаданное/нулевое значение означает дефолтную 1 минуту.
        return settings.Minutes > 0 ? settings.Minutes : DefaultMinutes;
    }

    internal static CdrPreviewAutoSearchSettingsDto Normalize(CdrPreviewAutoSearchSettingsDto settings)
    {
        var minutes = settings.Minutes;
        if (minutes < 0) minutes = 0;
        if (minutes > 1440) minutes = 1440;
        return new CdrPreviewAutoSearchSettingsDto { Minutes = minutes };
    }
}
