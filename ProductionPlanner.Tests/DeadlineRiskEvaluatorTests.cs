using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class DeadlineRiskEvaluatorTests
{
    [Fact]
    public void Evaluate_FromNow_WithDistantDeadline_IsOk()
    {
        var workHours = new WorkHoursCalculator();
        var now = new DateTime(2026, 5, 12, 12, 0, 0);
        var task = new ProductionTask
        {
            Deadline = new DateTime(2026, 5, 15, 15, 0, 0),
            EstimateHours = 2,
            Status = JobStatus.Assigned
        };

        var (level, _, _) = DeadlineRiskEvaluator.Evaluate(task, now, workHours);

        Assert.Equal("ok", level);
    }

    [Fact]
    public void ShouldShowInBanner_WarningSuppressedWhenDeadlineFar()
    {
        var now = new DateTime(2026, 5, 12, 12, 0, 0);
        var deadline = new DateTime(2026, 5, 15, 15, 0, 0);

        Assert.False(DeadlineRiskEvaluator.ShouldShowInBanner("warning", deadline, now));
    }

    [Fact]
    public void ShouldShowInBanner_WarningShownOnDeadlineDay()
    {
        var now = new DateTime(2026, 5, 15, 10, 0, 0);
        var deadline = new DateTime(2026, 5, 15, 15, 0, 0);

        Assert.True(DeadlineRiskEvaluator.ShouldShowInBanner("warning", deadline, now));
    }

    [Fact]
    public void Evaluate_FussTask_IsAlwaysOk()
    {
        var workHours = new WorkHoursCalculator();
        var now = new DateTime(2026, 5, 12, 12, 0, 0);
        var task = new ProductionTask
        {
            IsFuss = true,
            Deadline = null,
            EstimateHours = 0,
            Status = JobStatus.Assigned
        };

        var (level, required, _) = DeadlineRiskEvaluator.Evaluate(task, now, workHours);

        Assert.Equal("ok", level);
        Assert.Equal(0, required);
    }

    [Fact]
    public void Evaluate_NullDeadline_IsOk()
    {
        var workHours = new WorkHoursCalculator();
        var now = new DateTime(2026, 5, 12, 12, 0, 0);
        var task = new ProductionTask
        {
            Deadline = null,
            EstimateHours = 4,
            Status = JobStatus.Assigned
        };

        var (level, _, _) = DeadlineRiskEvaluator.Evaluate(task, now, workHours);

        Assert.Equal("ok", level);
    }
}
