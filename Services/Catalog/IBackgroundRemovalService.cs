namespace ProductionPlanner.Services.Catalog;

public interface IBackgroundRemovalService
{
    /// <summary>Returns PNG bytes with alpha, or null if the service is not configured / failed.</summary>
    Task<BackgroundRemovalResult> RemoveBackgroundAsync(
        byte[] imageBytes,
        string contentType,
        string? fileName,
        CancellationToken cancellationToken = default)
        => RemoveBackgroundAsync(imageBytes, contentType, fileName, null, cancellationToken);

    /// <summary>Same as above, but reports pipeline stages (percent 0..100, human-readable stage).</summary>
    Task<BackgroundRemovalResult> RemoveBackgroundAsync(
        byte[] imageBytes,
        string contentType,
        string? fileName,
        Action<double, string>? reportProgress,
        CancellationToken cancellationToken = default);

    /// <summary>Probes outbound connectivity to the background-removal Space (admin diagnostics).</summary>
    Task<BackgroundRemovalDiagnostics> DiagnoseAsync(CancellationToken cancellationToken = default);
}

public sealed record BackgroundRemovalResult(bool Success, byte[]? PngBytes, string? Error);

public sealed record BackgroundRemovalDiagnostics(
    string SpaceBaseUrl,
    bool ProxyEnabled,
    bool Reachable,
    int? HttpStatus,
    long ElapsedMs,
    string? ErrorKind,
    string? ErrorMessage);
