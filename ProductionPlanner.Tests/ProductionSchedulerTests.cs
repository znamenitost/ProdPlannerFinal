using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class ProductionSchedulerTests
{
    [Fact]
    public void CheckDeadlineRisks_AccountsForTasksScheduledBeforeDeadline()
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

        var secondTaskRisk = Assert.Single(risks, r => r.TaskId == 2);
        Assert.Equal("critical", secondTaskRisk.RiskLevel);
        Assert.Equal(0.5, secondTaskRisk.AvailableHoursBeforeDeadline);
    }
}
