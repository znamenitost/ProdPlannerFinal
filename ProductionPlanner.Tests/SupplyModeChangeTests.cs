using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class SupplyModeChangeTests
{
    [Fact]
    public void SwitchToSequential_keeps_in_progress_stages_and_queues_new_assigned_after_frontier()
    {
        var stage1 = new ProductionTask { Id = 1, Status = JobStatus.InProgress };
        var stage2 = new ProductionTask { Id = 2, Status = JobStatus.InProgress };
        var stage3 = new ProductionTask { Id = 3, Status = JobStatus.Assigned };

        SupplyWorkflow.ApplySupplyModeChange([
            (stage1, 1),
            (stage2, 2),
            (stage3, 3)
        ], SupplyMode.Cooperative, SupplyMode.InternalProduction);

        Assert.Equal(JobStatus.InProgress, stage1.Status);
        Assert.Equal(JobStatus.InProgress, stage2.Status);
        Assert.Equal(JobStatus.Waiting, stage3.Status);
    }

    [Fact]
    public void SwitchToSequential_keeps_assigned_before_frontier_when_later_stage_already_started()
    {
        var stage1 = new ProductionTask { Id = 1, Status = JobStatus.Assigned };
        var stage2 = new ProductionTask { Id = 2, Status = JobStatus.InProgress };

        SupplyWorkflow.ApplySupplyModeChange([
            (stage1, 1),
            (stage2, 2)
        ], SupplyMode.Cooperative, SupplyMode.InternalProduction);

        Assert.Equal(JobStatus.Assigned, stage1.Status);
        Assert.Equal(JobStatus.InProgress, stage2.Status);
    }

    [Fact]
    public void SwitchToSequential_when_nothing_started_keeps_first_assigned_rest_waiting()
    {
        var stage1 = new ProductionTask { Id = 1, Status = JobStatus.Assigned };
        var stage2 = new ProductionTask { Id = 2, Status = JobStatus.Assigned };
        var stage3 = new ProductionTask { Id = 3, Status = JobStatus.Assigned };

        SupplyWorkflow.ApplySupplyModeChange([
            (stage1, 1),
            (stage2, 2),
            (stage3, 3)
        ], SupplyMode.Cooperative, SupplyMode.InternalProduction);

        Assert.Equal(JobStatus.Assigned, stage1.Status);
        Assert.Equal(JobStatus.Waiting, stage2.Status);
        Assert.Equal(JobStatus.Waiting, stage3.Status);
    }

    [Fact]
    public void SwitchToParallel_promotes_waiting_without_work_to_assigned()
    {
        var stage1 = new ProductionTask { Id = 1, Status = JobStatus.Completed };
        var stage2 = new ProductionTask { Id = 2, Status = JobStatus.Waiting };

        SupplyWorkflow.ApplySupplyModeChange([
            (stage1, 1),
            (stage2, 2)
        ], SupplyMode.InternalProduction, SupplyMode.Cooperative);

        Assert.Equal(JobStatus.Completed, stage1.Status);
        Assert.Equal(JobStatus.Assigned, stage2.Status);
    }

    [Fact]
    public void SwitchToSequential_does_not_change_when_mode_unchanged()
    {
        var stage1 = new ProductionTask { Id = 1, Status = JobStatus.Assigned };

        SupplyWorkflow.ApplySupplyModeChange([
            (stage1, 1)
        ], SupplyMode.Cooperative, SupplyMode.Cooperative);

        Assert.Equal(JobStatus.Assigned, stage1.Status);
    }
}
