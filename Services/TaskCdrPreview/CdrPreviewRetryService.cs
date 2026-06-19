using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.TaskCdrPreview;

public interface ICdrPreviewRetryService
{
    Task ScheduleRetryAsync(int taskId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CdrPreviewRetryItemDto>> GetDueRetriesAsync(
        int limit = 50,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<int>> GetDueTaskIdsAsync(CancellationToken cancellationToken = default);

    Task RecordFailedRetryAsync(int taskId, CancellationToken cancellationToken = default);

    Task ClearRetryAsync(int taskId, CancellationToken cancellationToken = default);
}

public sealed class CdrPreviewRetryService : ICdrPreviewRetryService
{
    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _timeService;
    private readonly CdrPreviewRetryOptions _options;

    public CdrPreviewRetryService(
        ApplicationDbContext db,
        IAppTimeService timeService,
        IOptions<CdrPreviewRetryOptions> options)
    {
        _db = db;
        _timeService = timeService;
        _options = options.Value;
    }

    public async Task ScheduleRetryAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null || !IsCdrFileName(task.FileName))
            return;

        if (await HasPreviewAsync(taskId, cancellationToken))
        {
            await ClearRetryAsync(taskId, cancellationToken);
            return;
        }

        if (_options.MaxRetryAttempts <= 0)
            return;

        var now = _timeService.Now;
        task.CdrPreviewRetryAttempts = 0;
        task.CdrPreviewRetryAt = now.AddMinutes(Math.Max(1, _options.RetryDelayMinutes));
        task.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CdrPreviewRetryItemDto>> GetDueRetriesAsync(
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var now = _timeService.Now;
        var maxAttempts = Math.Max(0, _options.MaxRetryAttempts);
        var take = Math.Clamp(limit, 1, 200);

        var tasks = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t =>
                t.CdrPreviewRetryAt != null
                && t.CdrPreviewRetryAt <= now
                && t.CdrPreviewRetryAttempts < maxAttempts
                && t.FileName.ToLower().EndsWith(".cdr"))
            .OrderBy(t => t.CdrPreviewRetryAt)
            .Take(take)
            .Select(t => new CdrPreviewRetryItemDto
            {
                TaskId = t.Id,
                FolderPath = t.FolderPath,
                FileName = t.FileName
            })
            .ToListAsync(cancellationToken);

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

    public async Task RecordFailedRetryAsync(int taskId, CancellationToken cancellationToken = default)
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

        var now = _timeService.Now;
        task.CdrPreviewRetryAttempts += 1;

        if (task.CdrPreviewRetryAttempts >= Math.Max(1, _options.MaxRetryAttempts))
        {
            task.CdrPreviewRetryAt = null;
        }
        else
        {
            task.CdrPreviewRetryAt = now.AddMinutes(Math.Max(1, _options.RetryDelayMinutes));
        }

        task.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
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

    internal static bool IsCdrFileName(string? fileName)
    {
        var name = (fileName ?? string.Empty).Trim();
        return name.EndsWith(".cdr", StringComparison.OrdinalIgnoreCase);
    }
}
