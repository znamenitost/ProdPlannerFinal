namespace ProductionPlanner.Services.Catalog;

public interface IBackgroundRemovalService
{
    /// <summary>Returns PNG bytes with alpha, or null if the service is not configured / failed.</summary>
    Task<BackgroundRemovalResult> RemoveBackgroundAsync(
        byte[] imageBytes,
        string contentType,
        string? fileName,
        CancellationToken cancellationToken = default);
}

public sealed record BackgroundRemovalResult(bool Success, byte[]? PngBytes, string? Error);
