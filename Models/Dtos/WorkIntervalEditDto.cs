using ProductionPlanner.Infrastructure;

namespace ProductionPlanner.Models.Dtos;

public class WorkIntervalEditDto
{
    public int Id { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    public static WorkIntervalEditDto FromEntity(WorkInterval interval) => new()
    {
        Id = interval.Id,
        StartTime = AppDateTime.ToMoscowWallClockFromDb(interval.StartTime),
        EndTime = interval.EndTime.HasValue
            ? AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value)
            : null
    };
}
