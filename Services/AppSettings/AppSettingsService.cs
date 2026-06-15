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
        await using var command = _db.Database.GetDbConnection().CreateCommand();
        command.CommandText = _db.Database.IsNpgsql()
            ? """
              SELECT "Json"
              FROM "AppSettings"
              WHERE "Key" = @key
              LIMIT 1
              """
            : """
              SELECT Json
              FROM AppSettings
              WHERE Key = @key
              LIMIT 1
              """;

        var parameter = command.CreateParameter();
        parameter.ParameterName = "@key";
        parameter.Value = key;
        command.Parameters.Add(parameter);

        if (command.Connection?.State != System.Data.ConnectionState.Open)
            await _db.Database.OpenConnectionAsync(cancellationToken);

        var row = await command.ExecuteScalarAsync(cancellationToken) as string;
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

        if (_db.Database.IsNpgsql())
        {
            await _db.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO "AppSettings" ("Key", "Json", "UpdatedAt")
                VALUES ({0}, {1}, {2})
                ON CONFLICT ("Key") DO UPDATE
                SET "Json" = EXCLUDED."Json",
                    "UpdatedAt" = EXCLUDED."UpdatedAt"
                """,
                key,
                json,
                now);
            return;
        }

        await _db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO AppSettings (Key, Json, UpdatedAt)
            VALUES ({0}, {1}, {2})
            ON CONFLICT(Key) DO UPDATE SET
                Json = excluded.Json,
                UpdatedAt = excluded.UpdatedAt
            """,
            key,
            json,
            now);
    }
}
