using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class ProductionSchedulerTests
{
    [Fact]
    public void CheckDeadlineRisks_UsesHoursFromNow_NotPlannedSlotStart()
    {
        var scheduler = new ProductionScheduler(new WorkHoursCalculator());
        var now = new DateTime(2026, 5, 12, 12, 0, 0);
        var deadline = new DateTime(2026, 5, 15, 15, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "first.cdr",
                Deadline = deadline,
                EstimateHours = 1.5,
                Status = JobStatus.Assigned
            },
            new()
            {
                Id = 2,
                FileName = "second.cdr",
                Deadline = deadline,
                EstimateHours = 1,
                Status = JobStatus.Assigned
            }
        };

        var risks = scheduler.CheckDeadlineRisks(tasks, now);

        Assert.Empty(risks);
    }

    [Fact]
    public void CheckDeadlineRisks_CriticalWhenNotEnoughHoursFromNow()
    {
        var scheduler = new ProductionScheduler(new WorkHoursCalculator());
        var now = new DateTime(2026, 5, 21, 18, 0, 0);
        var deadline = new DateTime(2026, 5, 22, 11, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "tight.cdr",
                Deadline = deadline,
                EstimateHours = 3,
                Status = JobStatus.Assigned
            }
        };

        var risks = scheduler.CheckDeadlineRisks(tasks, now);
        var risk = Assert.Single(risks);

        Assert.Equal("critical", risk.RiskLevel);
    }

    [Fact]
    public void CheckDeadlineRisks_WarningOnlyWhenDeadlineIsTodayOrTomorrow()
    {
        var scheduler = new ProductionScheduler(new WorkHoursCalculator());
        var now = new DateTime(2026, 5, 21, 12, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "far.cdr",
                Deadline = new DateTime(2026, 5, 28, 15, 0, 0),
                EstimateHours = 2,
                Status = JobStatus.Assigned
            }
        };

        var risks = scheduler.CheckDeadlineRisks(tasks, now);

        Assert.Empty(risks);
    }

    [Fact]
    public void CheckQueueOverloads_WhenPlannedEndAfterDeadline()
    {
        var scheduler = new ProductionScheduler(new WorkHoursCalculator());
        var now = new DateTime(2026, 5, 21, 18, 0, 0);
        var deadline = new DateTime(2026, 5, 22, 11, 0, 0);
        var tasks = new List<ProductionTask>
        {
            new()
            {
                Id = 1,
                FileName = "first.cdr",
                EmployeeName = "Дима",
                Deadline = deadline,
                EstimateHours = 1.5,
                Status = JobStatus.Assigned
            },
            new()
            {
                Id = 2,
                FileName = "second.cdr",
                EmployeeName = "Дима",
                Deadline = deadline,
                EstimateHours = 1,
                Status = JobStatus.Assigned
            }
        };

        var overloads = scheduler.CheckQueueOverloads(tasks, now);

        var second = Assert.Single(overloads, o => o.TaskId == 2);
        Assert.Equal("Дима", second.EmployeeName);
    }
}
