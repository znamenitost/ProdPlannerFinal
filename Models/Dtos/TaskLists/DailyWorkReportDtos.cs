namespace ProductionPlanner.Models.Dtos.TaskLists;

public sealed class DailyWorkReportDto
{
    public DateTime Date { get; init; }
    public IReadOnlyList<DailyWorkReportItemDto> Items { get; init; } = [];
    public double TotalHours { get; init; }
}

public sealed class DailyWorkReportItemDto
{
    public int TaskId { get; init; }
    public string Title { get; init; } = string.Empty;
    public IReadOnlyList<double> IntervalHours { get; init; } = [];
    public double TotalHours { get; init; }
    public bool IsCompleted { get; init; }
    public string StatusText { get; init; } = string.Empty;
}
