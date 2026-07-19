namespace ProductionPlanner.Models.Dtos;

public class TaskTypeStatsDto
{
    public DateTime CalculatedAt { get; set; }
    public int TotalTasks { get; set; }
    public double TotalActualHours { get; set; }
    public List<TaskTypeBucketDto> Items { get; set; } = [];
}

public class TaskTypeBucketDto
{
    public string Type { get; set; } = string.Empty;
    public int TaskCount { get; set; }
    public double TotalActualHours { get; set; }
}
