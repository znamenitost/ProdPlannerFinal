using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;

namespace ProductionPlanner.Services.AppSettings;

public class AppSettingsService : IAppSettingsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _timeService;

    public AppSettingsService(ApplicationDbContext db, IAppTimeService timeService)
    {
        _db = db;
        _timeService = timeService;
    }

    public async Task<T?> GetJsonAsync<T>(string key, CancellationToken cancellationToken = default)
        where T : class
    {
        var row = await _db.AppSettings
            .AsNoTracking()
            .Where(s => s.Key == key)
            .Select(s => s.Json)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(row))
            return null;

        try
        {
            return JsonSerializer.Deserialize<T>(row, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task SaveJsonAsync<T>(string key, T value, CancellationToken cancellationToken = default)
        where T : class
    {
        var json = JsonSerializer.Serialize(value, JsonOptions);
        var now = _timeService.Now;
        var existing = await _db.AppSettings
            .FirstOrDefaultAsync(s => s.Key == key, cancellationToken);

        if (existing == null)
        {
            _db.AppSettings.Add(new Models.AppSetting
            {
                Key = key,
                Json = json,
                UpdatedAt = now
            });
        }
        else
        {
            existing.Json = json;
            existing.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}
