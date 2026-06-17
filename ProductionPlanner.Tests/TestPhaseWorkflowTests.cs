using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class TestPhaseWorkflowTests
{
    [Fact]
    public void GetActiveEstimateHours_uses_test_hours_in_test_phase()
    {
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.Test,
            TestEstimateHours = 1.5,
            ProductionEstimateHours = 4,
            EstimateHours = 5.5
        };

        Assert.Equal(1.5, TestPhaseWorkflow.GetActiveEstimateHours(task));
    }

    [Fact]
    public void GetActiveEstimateHours_uses_production_hours_in_production_phase()
    {
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.Production,
            TestEstimateHours = 1.5,
            ProductionEstimateHours = 4,
            EstimateHours = 5.5
        };

        Assert.Equal(4, TestPhaseWorkflow.GetActiveEstimateHours(task));
    }

    [Fact]
    public void IsActiveTestPhase_true_when_work_phase_none_but_flag_set()
    {
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.None,
            TestEstimateHours = 1,
            ProductionEstimateHours = 2,
        };

        Assert.True(TestPhaseWorkflow.IsActiveTestPhase(task));
    }

    [Fact]
    public void IsActiveTestPhase_true_for_split_child()
    {
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.Test,
            IsSplitTask = true,
            ParentRowNumber = 10
        };

        Assert.True(TestPhaseWorkflow.IsActiveTestPhase(task));
    }

    [Fact]
    public void TaskShowsThroughApproval_true_for_split_parent_with_active_test_child()
    {
        var parent = new ProductionTask
        {
            IsSplitTask = true,
            Status = JobStatus.InProgress
        };
        var child = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.Test,
            IsSplitTask = true,
            ParentRowNumber = 1,
            Status = JobStatus.InProgress
        };

        Assert.True(TestPhaseWorkflow.TaskShowsThroughApproval(parent, [child]));
    }

    [Fact]
    public void TaskShowsThroughApproval_false_for_split_parent_when_child_awaiting_approval()
    {
        var parent = new ProductionTask
        {
            IsSplitTask = true,
            Status = JobStatus.InProgress
        };
        var child = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.AwaitingApproval,
            IsSplitTask = true,
            ParentRowNumber = 1,
            Status = JobStatus.PendingApproval
        };

        Assert.False(TestPhaseWorkflow.TaskShowsThroughApproval(parent, [child]));
    }

    [Fact]
    public void ComputeSavedHours_splits_test_and_production_intervals()
    {
        var testEnd = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.Done,
            TestEstimateHours = 1.5,
            ProductionEstimateHours = 4,
            EstimateHours = 5.5,
            TestPhaseCompletedAt = testEnd
        };
        var intervals = new List<WorkInterval>
        {
            new()
            {
                StartTime = testEnd.AddHours(-2),
                EndTime = testEnd.AddHours(-0.5)
            },
            new()
            {
                StartTime = testEnd.AddHours(1),
                EndTime = testEnd.AddHours(2)
            }
        };

        double Hours(DateTime start, DateTime end) => (end - start).TotalHours;

        var saved = TestPhaseWorkflow.ComputeSavedHours(task, intervals, Hours);

        Assert.Equal(3, saved, precision: 2);
    }

    [Fact]
    public void GetIntervalsForCompletion_returns_only_post_test_intervals_in_production()
    {
        var testEnd = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            WorkPhase = TaskWorkPhase.Production,
            TestPhaseCompletedAt = testEnd
        };
        var intervals = new List<WorkInterval>
        {
            new() { StartTime = testEnd.AddHours(-1), EndTime = testEnd.AddHours(-0.5) },
            new() { StartTime = testEnd.AddHours(1), EndTime = testEnd.AddHours(2) }
        };

        var completion = TestPhaseWorkflow.GetIntervalsForCompletion(task, intervals);

        Assert.Single(completion);
        Assert.Equal(testEnd.AddHours(1), completion[0].StartTime);
    }
}
