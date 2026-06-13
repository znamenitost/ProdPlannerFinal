namespace ProductionPlanner.Services.TaskCdrPreview;

public interface ITaskCdrPreviewService
{
    Task<(byte[] Bytes, string ContentType, DateTime UpdatedAt, string SourceKey)?> GetAsync(
        int taskId,
        CancellationToken cancellationToken = default);

    Task SaveAsync(
        int taskId,
        Stream imageStream,
        string sourceKey,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(int taskId, CancellationToken cancellationToken = default);
}
