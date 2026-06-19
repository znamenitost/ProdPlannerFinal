namespace ProductionPlanner.Services.TaskCdrPreview;

public sealed class CdrPreviewRetryOptions
{
    public const string SectionName = "CdrPreview";

    public int RetryDelayMinutes { get; set; } = 5;

    public int MaxRetryAttempts { get; set; } = 5;
}
