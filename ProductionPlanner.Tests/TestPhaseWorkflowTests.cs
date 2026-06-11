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
    public void IsTestPhaseTask_false_for_split_parent_row()
    {
        var task = new ProductionTask
        {
            RequiresTestBeforeProduction = true,
            IsSplitTask = true,
            ParentRowNumber = null
        };

        Assert.False(TestPhaseWorkflow.IsTestPhaseTask(task));
    }
}
