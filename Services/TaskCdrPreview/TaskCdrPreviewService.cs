using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace ProductionPlanner.Services.TaskCdrPreview;

public class TaskCdrPreviewService : ITaskCdrPreviewService
{
    private const int MaxPreviewEdge = 640;
    private const int MaxUploadBytes = 5 * 1024 * 1024;

    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _timeService;

    public TaskCdrPreviewService(ApplicationDbContext db, IAppTimeService timeService)
    {
        _db = db;
        _timeService = timeService;
    }

    public async Task<(byte[] Bytes, string ContentType, DateTime UpdatedAt, string SourceKey)?> GetAsync(
        int taskId,
        CancellationToken cancellationToken = default)
    {
        var preview = await _db.TaskCdrPreviews
            .AsNoTracking()
            .Where(p => p.TaskId == taskId)
            .Select(p => new { p.Data, p.ContentType, p.UpdatedAt, p.SourceKey })
            .FirstOrDefaultAsync(cancellationToken);

        if (preview == null || preview.Data.Length == 0)
            return null;

        return (preview.Data, preview.ContentType, preview.UpdatedAt, preview.SourceKey);
    }

    public async Task SaveAsync(
        int taskId,
        Stream imageStream,
        string sourceKey,
        CancellationToken cancellationToken = default)
    {
        if (imageStream.CanSeek && imageStream.Length > MaxUploadBytes)
            throw new ArgumentException("Превью слишком большое");

        await using var input = new MemoryStream();
        await imageStream.CopyToAsync(input, cancellationToken);
        if (input.Length == 0)
            throw new ArgumentException("Пустой файл превью");
        if (input.Length > MaxUploadBytes)
            throw new ArgumentException("Превью слишком большое");

        var taskExists = await _db.ProductionTasks
            .AnyAsync(t => t.Id == taskId, cancellationToken);
        if (!taskExists)
            throw new ArgumentException("Задача не найдена");

        input.Position = 0;
        byte[] webpBytes;
        using (var image = await Image.LoadAsync(input, cancellationToken))
        {
            if (image.Width > MaxPreviewEdge || image.Height > MaxPreviewEdge)
            {
                image.Mutate(ctx => ctx.Resize(new ResizeOptions
                {
                    Size = new Size(MaxPreviewEdge, MaxPreviewEdge),
                    Mode = ResizeMode.Max
                }));
            }

            await using var output = new MemoryStream();
            var encoder = new WebpEncoder { Quality = 82 };
            await image.SaveAsWebpAsync(output, encoder, cancellationToken);
            webpBytes = output.ToArray();
        }

        var now = _timeService.Now;
        var normalizedSourceKey = (sourceKey ?? string.Empty).Trim();
        var existing = await _db.TaskCdrPreviews
            .FirstOrDefaultAsync(p => p.TaskId == taskId, cancellationToken);

        if (existing == null)
        {
            _db.TaskCdrPreviews.Add(new Models.TaskCdrPreview
            {
                TaskId = taskId,
                ContentType = "image/webp",
                Data = webpBytes,
                ByteSize = webpBytes.Length,
                SourceKey = normalizedSourceKey,
                UpdatedAt = now
            });
        }
        else
        {
            existing.ContentType = "image/webp";
            existing.Data = webpBytes;
            existing.ByteSize = webpBytes.Length;
            existing.SourceKey = normalizedSourceKey;
            existing.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var existing = await _db.TaskCdrPreviews
            .FirstOrDefaultAsync(p => p.TaskId == taskId, cancellationToken);
        if (existing == null)
            return;

        _db.TaskCdrPreviews.Remove(existing);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<HashSet<int>> GetExistingTaskIdsAsync(
        IReadOnlyList<int> taskIds,
        CancellationToken cancellationToken = default)
    {
        if (taskIds.Count == 0)
            return new HashSet<int>();

        var ids = await _db.TaskCdrPreviews
            .AsNoTracking()
            .Where(p => taskIds.Contains(p.TaskId) && p.Data.Length > 0)
            .Select(p => p.TaskId)
            .ToListAsync(cancellationToken);

        return ids.ToHashSet();
    }
}
