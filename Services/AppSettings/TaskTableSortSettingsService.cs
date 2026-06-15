using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.AppSettings;

public interface ITaskTableSortSettingsService
{
    Task<TaskTableSortSettingsDto?> GetForUserAsync(string userId, CancellationToken cancellationToken = default);
    Task SaveForUserAsync(string userId, TaskTableSortSettingsDto settings, CancellationToken cancellationToken = default);
}

public class TaskTableSortSettingsService : ITaskTableSortSettingsService
{
    public const string KeyPrefix = "user-settings:task-table-sort:";

    private readonly IAppSettingsService _appSettings;

    public TaskTableSortSettingsService(IAppSettingsService appSettings)
    {
        _appSettings = appSettings;
    }

    public static string BuildStorageKey(string userId) => KeyPrefix + userId;

    public async Task<TaskTableSortSettingsDto?> GetForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _appSettings.GetJsonAsync<TaskTableSortSettingsDto>(
            BuildStorageKey(userId),
            cancellationToken);
    }

    public Task SaveForUserAsync(
        string userId,
        TaskTableSortSettingsDto settings,
        CancellationToken cancellationToken = default)
    {
        return _appSettings.SaveJsonAsync(BuildStorageKey(userId), settings, cancellationToken);
    }
}
