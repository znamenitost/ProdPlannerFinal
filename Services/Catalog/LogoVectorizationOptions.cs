namespace ProductionPlanner.Services.Catalog;

public sealed class LogoVectorizationOptions
{
    public const string SectionName = "LogoVectorization";

    /// <summary>Path to the vtracer executable, relative to the content root.</summary>
    public string ExecutablePath { get; set; } = "tools/vtracer/vtracer.exe";

    public int MaxUploadBytes { get; set; } = 5 * 1024 * 1024;

    public long MaxPixels { get; set; } = 12_000_000;

    public int TimeoutSeconds { get; set; } = 60;

    public int MaxColors { get; set; } = 16;
}
