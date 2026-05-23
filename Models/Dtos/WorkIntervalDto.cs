namespace ProductionPlanner.Models.Dtos;

public class WorkIntervalDto
{
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    public static WorkIntervalDto FromEntity(WorkInterval interval) => new()
    {
        StartTime = interval.StartTime,
        EndTime = interval.EndTime
    };
}
