using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public class PlanningWarningService : IPlanningWarningService
{
    private readonly IProductionTaskRepository _repo;
    private readonly IProductionScheduler _scheduler;
    private readonly IWorkHoursCalculator _workHours;

    public PlanningWarningService(
        IProductionTaskRepository repo,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours)
    {
        _repo = repo;
        _scheduler = scheduler;
        _workHours = workHours;
    }

    public async Task<IReadOnlyList<PlanningWarningDto>> GetWarningsForEmployeesAsync(
        IEnumerable<string> employeeNames,
        DateTime now,
        IReadOnlySet<int>? focusTaskIds,
        CancellationToken cancellationToken = default)
    {
        var result = new List<PlanningWarningDto>();
        foreach (var employee in employeeNames
                     .Where(e => !string.IsNullOrWhiteSpace(e))
                     .Distinct(StringComparer.Ordinal))
        {
            var tasks = await _repo.GetActiveTasksAsync(employee, cancellationToken);
            result.AddRange(ComputeWarnings(tasks, now, focusTaskIds, _scheduler, _workHours));
        }

        return result;
    }

    public static List<PlanningWarningDto> ComputeWarnings(
        List<ProductionTask> activeTasks,
        DateTime now,
        IReadOnlySet<int>? focusTaskIds,
        IProductionScheduler scheduler,
        IWorkHoursCalculator workHours)
    {
        var warnings = new List<PlanningWarningDto>();
        var slots = scheduler.GetSchedule(activeTasks, now);
        var lastEndByTask = slots
            .GroupBy(s => s.Task.Id)
            .ToDictionary(g => g.Key, g => g.Max(s => s.PlannedEnd));

        var candidates = activeTasks.Where(t =>
            t.Status != JobStatus.Completed && t.Progress < 0.99);

        if (focusTaskIds is { Count: > 0 })
            candidates = candidates.Where(t => focusTaskIds.Contains(t.Id));

        foreach (var task in candidates)
        {
            if (AppDateTime.CompareDeadlineToAppNow(task.Deadline, now) < 0)
                continue;

            var (riskLevel, hoursNeeded, available) =
                DeadlineRiskEvaluator.Evaluate(task, now, workHours);

            if (riskLevel == "critical")
            {
                warnings.Add(new PlanningWarningDto
                {
                    Kind = "hoursShortfall",
                    TaskId = task.Id,
                    TaskTitle = task.TaskDisplayName,
                    FileName = task.FileName,
                    EmployeeName = task.EmployeeName,
                    Deadline = task.Deadline,
                    RequiredHours = hoursNeeded,
                    AvailableHours = available,
                    Message =
                        $"«{task.TaskDisplayName}»: до дедлайна {FormatDeadline(task.Deadline)} " +
                        $"осталось {available:0.#} раб. ч, нужно {hoursNeeded:0.#} ч — даже без очереди не успеть."
                });
            }

            if (!lastEndByTask.TryGetValue(task.Id, out var plannedEnd))
                continue;

            var deadlineMoscow = AppDateTime.ToMoscowWallClockFromDb(task.Deadline);
            if (plannedEnd <= deadlineMoscow)
                continue;

            warnings.Add(new PlanningWarningDto
            {
                Kind = "queueOverflow",
                TaskId = task.Id,
                TaskTitle = task.TaskDisplayName,
                FileName = task.FileName,
                EmployeeName = task.EmployeeName,
                Deadline = task.Deadline,
                PlannedEnd = plannedEnd,
                RequiredHours = hoursNeeded,
                AvailableHours = available,
                Message =
                    $"«{task.TaskDisplayName}» ({task.EmployeeName}): в очереди план до {plannedEnd:dd.MM HH:mm}, " +
                    $"дедлайн {deadlineMoscow:dd.MM HH:mm} — не влезает в очередь."
            });
        }

        return warnings;
    }

    private static string FormatDeadline(DateTime deadline)
    {
        var moscow = AppDateTime.ToMoscowWallClockFromDb(deadline);
        return moscow.ToString("dd.MM HH:mm");
    }
}
