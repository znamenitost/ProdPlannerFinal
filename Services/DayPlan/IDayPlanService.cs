using ProductionPlanner.Models.Dtos.DayPlan;

namespace ProductionPlanner.Services.DayPlan;

public interface IDayPlanService
{
    Task<DayPlanResponseDto> GetDayPlanAsync(
        string employee,
        string? date,
        DateTime currentTime,
        CancellationToken cancellationToken = default);
}
