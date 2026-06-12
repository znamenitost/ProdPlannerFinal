using ProductionPlanner.Data;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

public interface IEmployeeAssignmentLoadService
{
    Task<IReadOnlyDictionary<string, int>> GetActiveTaskCountsAsync(
        IEnumerable<string> employeeNames,
        CancellationToken cancellationToken = default);
}

public class EmployeeAssignmentLoadService : IEmployeeAssignmentLoadService
{
    private readonly IProductionTaskRepository _repo;

    public EmployeeAssignmentLoadService(IProductionTaskRepository repo)
    {
        _repo = repo;
    }

    public async Task<IReadOnlyDictionary<string, int>> GetActiveTaskCountsAsync(
        IEnumerable<string> employeeNames,
        CancellationToken cancellationToken = default)
    {
        var names = employeeNames
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var counts = names.ToDictionary(name => name, _ => 0, StringComparer.Ordinal);
        if (names.Count == 0)
            return counts;

        var tasks = await _repo.GetActiveTasksForEmployeesAsync(names, cancellationToken);
        foreach (var task in tasks.Where(IsCountableForAssignmentLoad))
        {
            if (counts.ContainsKey(task.EmployeeName))
                counts[task.EmployeeName]++;
        }

        return counts;
    }

    public static bool IsCountableForAssignmentLoad(ProductionTask task) =>
        task.Status is not (
            JobStatus.PendingApproval
            or JobStatus.NoItems
            or JobStatus.Waiting);
}
