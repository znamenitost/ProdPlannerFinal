using Microsoft.Extensions.Configuration;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.AppSettings;

public interface IFileOpenSettingsService
{
    Task<FileOpenSettingsDto> GetAsync(CancellationToken cancellationToken = default);
    Task SaveAsync(FileOpenSettingsDto settings, CancellationToken cancellationToken = default);
}

public class FileOpenSettingsService : IFileOpenSettingsService
{
    public const string SettingsKey = "file-open";

    private readonly IAppSettingsService _appSettings;
    private readonly IConfiguration _configuration;

    public FileOpenSettingsService(IAppSettingsService appSettings, IConfiguration configuration)
    {
        _appSettings = appSettings;
        _configuration = configuration;
    }

    public async Task<FileOpenSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var defaults = ReadDefaults();
        var stored = await _appSettings.GetJsonAsync<FileOpenSettingsDto>(SettingsKey, cancellationToken);
        if (stored == null)
            return defaults;

        return new FileOpenSettingsDto
        {
            WindowsHost = FirstNonEmpty(stored.WindowsHost, defaults.WindowsHost),
            ShareName = FirstNonEmpty(stored.ShareName, defaults.ShareName),
            MacSmbHost = FirstNonEmpty(stored.MacSmbHost, defaults.MacSmbHost)
        };
    }

    public Task SaveAsync(FileOpenSettingsDto settings, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);

        var normalized = new FileOpenSettingsDto
        {
            WindowsHost = NormalizeHost(settings.WindowsHost),
            ShareName = NormalizeShare(settings.ShareName),
            MacSmbHost = NormalizeHost(settings.MacSmbHost)
        };

        if (string.IsNullOrEmpty(normalized.WindowsHost))
            throw new ArgumentException("Укажите имя Windows-сервера (ПК в сети).");
        if (string.IsNullOrEmpty(normalized.ShareName))
            throw new ArgumentException("Укажите имя шары (корень файлов).");
        if (string.IsNullOrEmpty(normalized.MacSmbHost))
            throw new ArgumentException("Укажите хост для Mac (SMB).");

        return _appSettings.SaveJsonAsync(SettingsKey, normalized, cancellationToken);
    }

    private FileOpenSettingsDto ReadDefaults() => new()
    {
        WindowsHost = FirstNonEmpty(
            _configuration["FileOpen:WindowsHost"],
            FilePathNormalizer.WindowsServerHostName),
        ShareName = FirstNonEmpty(_configuration["FileOpen:ShareName"], "Клиенты"),
        MacSmbHost = FirstNonEmpty(_configuration["FileOpen:MacSmbHost"], "minimarker")
    };

    private static string NormalizeHost(string? value) =>
        (value ?? string.Empty).Trim().Trim('\\', '/');

    private static string NormalizeShare(string? value) =>
        (value ?? string.Empty).Trim().Trim('\\', '/');

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            var trimmed = (value ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(trimmed))
                return trimmed;
        }

        return string.Empty;
    }
}
