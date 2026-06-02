using ProductionPlanner.Models;

namespace ProductionPlanner.Models.Dtos;

public class LunchIntervalDto
{
    public int Id { get; set; }
    public string EmployeeName { get; set; } = "";
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    public static LunchIntervalDto FromEntity(LunchInterval interval) => new()
    {
        Id = interval.Id,
        EmployeeName = interval.EmployeeName,
        StartTime = interval.StartTime,
        EndTime = interval.EndTime
    };
}
