using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class SupplyWorkflowTests
{
    [Theory]
    [InlineData(SupplyMode.InternalProduction, 1, JobStatus.Assigned)]
    [InlineData(SupplyMode.InternalProduction, 2, JobStatus.Waiting)]
    [InlineData(SupplyMode.Cooperative, 2, JobStatus.Assigned)]
    [InlineData(SupplyMode.None, 1, JobStatus.Assigned)]
    public void InitialChildStatus_RespectsModeAndOrder(
        SupplyMode mode,
        int sequenceOrder,
        JobStatus expected)
    {
        Assert.Equal(expected, SupplyWorkflow.InitialChildStatus(mode, sequenceOrder));
    }

    [Fact]
    public void ReconcileSequentialStatuses_AssignsFirstActiveStage()
    {
        var stage1 = new ProductionTask { Status = JobStatus.Completed };
        var stage2 = new ProductionTask { Status = JobStatus.Waiting };
        var stage3 = new ProductionTask { Status = JobStatus.Waiting };

        SupplyWorkflow.ReconcileSequentialStatuses([
            (stage1, 1),
            (stage2, 2),
            (stage3, 3)
        ]);

        Assert.Equal(JobStatus.Assigned, stage2.Status);
        Assert.Equal(JobStatus.Waiting, stage3.Status);
    }

    [Fact]
    public void FindNextWaitingChild_ReturnsLowestOrderWaiting()
    {
        var stage2 = new ProductionTask { Id = 2, Status = JobStatus.Waiting };
        var stage3 = new ProductionTask { Id = 3, Status = JobStatus.Waiting };

        var next = SupplyWorkflow.FindNextWaitingChild([
            (stage3, 3),
            (stage2, 2)
        ]);

        Assert.Same(stage2, next);
    }
}
