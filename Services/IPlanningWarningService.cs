using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public interface IPlanningWarningService
{
    Task<IReadOnlyList<PlanningWarningDto>> GetWarningsForEmployeesAsync(
        IEnumerable<string> employeeNames,
        DateTime now,
        IReadOnlySet<int>? focusTaskIds,
        CancellationToken cancellationToken = default);
}
