using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class PlanningWarningServiceTests
{
    private static readonly DateTime Now = new(2026, 5, 21, 10, 0, 0);

    [Fact]
    public void ComputeWarnings_hoursShortfall_whenNotEnoughWorkHours()
    {
        var workHours = new WorkHoursCalculator();
        var scheduler = new ProductionScheduler(workHours);
        var deadline = new DateTime(2026, 5, 21, 12, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "urgent.cdr",
                EmployeeName = "Дима",
                Deadline = deadline,
                EstimateHours = 4,
                Status = JobStatus.Assigned
            }
        };

        var warnings = PlanningWarningService.ComputeWarnings(
            tasks, Now, focusTaskIds: null, scheduler, workHours);

        var shortfall = Assert.Single(warnings, w => w.Kind == "hoursShortfall");
        Assert.Equal(1, shortfall.TaskId);
    }

    [Fact]
    public void ComputeWarnings_skipsOverdueTasks()
    {
        var workHours = new WorkHoursCalculator();
        var scheduler = new ProductionScheduler(workHours);
        var pastDeadline = new DateTime(2026, 5, 20, 12, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "late.cdr",
                EmployeeName = "Дима",
                Deadline = pastDeadline,
                EstimateHours = 8,
                Status = JobStatus.Assigned
            }
        };

        var warnings = PlanningWarningService.ComputeWarnings(
            tasks, Now, focusTaskIds: null, scheduler, workHours);

        Assert.Empty(warnings);
    }

    [Fact]
    public void CheckQueueOverloads_skipsOverdueTasks()
    {
        var scheduler = new ProductionScheduler(new WorkHoursCalculator());
        var pastDeadline = new DateTime(2026, 5, 20, 12, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "late.cdr",
                EmployeeName = "Дима",
                Deadline = pastDeadline,
                EstimateHours = 8,
                Status = JobStatus.Assigned
            }
        };

        var overloads = scheduler.CheckQueueOverloads(tasks, Now);

        Assert.Empty(overloads);
    }
}
