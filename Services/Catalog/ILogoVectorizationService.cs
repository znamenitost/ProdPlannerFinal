namespace ProductionPlanner.Services.Catalog;

public interface ILogoVectorizationService
{
    Task<LogoVectorizationResult> VectorizeAsync(
        byte[] imageBytes,
        CancellationToken cancellationToken = default);
}

public sealed record LogoVectorizationResult(bool Success, byte[]? SvgBytes, string? Error);
