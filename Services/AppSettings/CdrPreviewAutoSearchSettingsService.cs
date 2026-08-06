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

    /// <summary>Дефолтная задержка повторного поиска превью CDR, минут (пока CDR появляется на шаре).</summary>
    public const int DefaultMinutes = 2;

    private readonly IAppSettingsService _appSettings;

    public CdrPreviewAutoSearchSettingsService(IAppSettingsService appSettings)
    {
        _appSettings = appSettings;
    }

    public async Task<CdrPreviewAutoSearchSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var stored = await _appSettings.GetJsonAsync<CdrPreviewAutoSearchSettingsDto>(SettingsKey, cancellationToken);
        if (stored == null)
            return new CdrPreviewAutoSearchSettingsDto { Minutes = DefaultMinutes };

        return Normalize(stored);
    }

    public Task SaveAsync(CdrPreviewAutoSearchSettingsDto settings, CancellationToken cancellationToken = default)
    {
        return _appSettings.SaveJsonAsync(SettingsKey, Normalize(settings), cancellationToken);
    }

    public async Task<int> GetMinutesAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetAsync(cancellationToken);
        // 0 в сохранённых настройках — автопоиск выключен (поле SAVE в тулбаре).
        return settings.Minutes;
    }

    internal static CdrPreviewAutoSearchSettingsDto Normalize(CdrPreviewAutoSearchSettingsDto settings)
    {
        var minutes = settings.Minutes;
        if (minutes < 0) minutes = 0;
        if (minutes > 1440) minutes = 1440;
        return new CdrPreviewAutoSearchSettingsDto { Minutes = minutes };
    }
}
