using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Services.TaskCdrPreview;

public interface ICdrPreviewRetryService
{
    Task ScheduleSecondAttemptAsync(int taskId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CdrPreviewRetryItemDto>> GetDueRetriesAsync(
        int limit = 50,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<int>> GetDueTaskIdsAsync(CancellationToken cancellationToken = default);

    Task MarkAutoSearchFailedAsync(int taskId, CancellationToken cancellationToken = default);

    Task ClearRetryAsync(int taskId, CancellationToken cancellationToken = default);
}

public sealed class CdrPreviewRetryService : ICdrPreviewRetryService
{
    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _timeService;
    private readonly ICdrPreviewAutoSearchSettingsService _autoSearchSettings;

    public CdrPreviewRetryService(
        ApplicationDbContext db,
        IAppTimeService timeService,
        ICdrPreviewAutoSearchSettingsService autoSearchSettings)
    {
        _db = db;
        _timeService = timeService;
        _autoSearchSettings = autoSearchSettings;
    }

    public async Task ScheduleSecondAttemptAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var autoSearchMinutes = await _autoSearchSettings.GetMinutesAsync(cancellationToken);
        if (autoSearchMinutes <= 0)
            return;

        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null || !FilePathNormalizer.IsEligibleForCdrPreview(task.FolderPath, task.FileName))
            return;

        if (await HasPreviewAsync(taskId, cancellationToken))
        {
            await ClearRetryInternalAsync(task, cancellationToken);
            return;
        }

        var now = _timeService.Now;
        task.CdrPreviewRetryAttempts = 1;
        task.CdrPreviewRetryAt = now.AddMinutes(autoSearchMinutes);
        task.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CdrPreviewRetryItemDto>> GetDueRetriesAsync(
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var autoSearchMinutes = await _autoSearchSettings.GetMinutesAsync(cancellationToken);
        if (autoSearchMinutes <= 0)
            return Array.Empty<CdrPreviewRetryItemDto>();

        var now = _timeService.Now;
        var take = Math.Clamp(limit, 1, 200);

        var candidates = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t =>
                t.CdrPreviewRetryAt != null
                && t.CdrPreviewRetryAt <= now
                && t.CdrPreviewRetryAttempts == 1
                && t.FileName != "")
            .OrderBy(t => t.CdrPreviewRetryAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        var tasks = candidates
            .Where(t => FilePathNormalizer.IsEligibleForCdrPreview(t.FolderPath, t.FileName))
            .Select(t => new CdrPreviewRetryItemDto
            {
                TaskId = t.Id,
                FolderPath = t.FolderPath,
                FileName = t.FileName,
                AutoSearchMinutes = autoSearchMinutes
            })
            .ToList();

        if (tasks.Count == 0)
            return tasks;

        var taskIds = tasks.Select(t => t.TaskId).ToList();
        var previewIds = await _db.TaskCdrPreviews
            .AsNoTracking()
            .Where(p => taskIds.Contains(p.TaskId) && p.ByteSize > 0)
            .Select(p => p.TaskId)
            .ToListAsync(cancellationToken);

        if (previewIds.Count == 0)
            return tasks;

        var previewSet = previewIds.ToHashSet();
        return tasks.Where(t => !previewSet.Contains(t.TaskId)).ToList();
    }

    public async Task<IReadOnlyList<int>> GetDueTaskIdsAsync(CancellationToken cancellationToken = default)
    {
        var items = await GetDueRetriesAsync(cancellationToken: cancellationToken);
        return items.Select(i => i.TaskId).ToList();
    }

    public async Task MarkAutoSearchFailedAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null)
            return;

        if (await HasPreviewAsync(taskId, cancellationToken))
        {
            await ClearRetryInternalAsync(task, cancellationToken);
            return;
        }

        await ClearRetryInternalAsync(task, cancellationToken);
    }

    public async Task ClearRetryAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null)
            return;

        await ClearRetryInternalAsync(task, cancellationToken);
    }

    private async Task ClearRetryInternalAsync(
        Models.ProductionTask task,
        CancellationToken cancellationToken)
    {
        if (task.CdrPreviewRetryAt == null && task.CdrPreviewRetryAttempts == 0)
            return;

        task.CdrPreviewRetryAt = null;
        task.CdrPreviewRetryAttempts = 0;
        task.UpdatedAt = _timeService.Now;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> HasPreviewAsync(int taskId, CancellationToken cancellationToken)
    {
        return await _db.TaskCdrPreviews
            .AsNoTracking()
            .AnyAsync(p => p.TaskId == taskId && p.ByteSize > 0, cancellationToken);
    }
}
