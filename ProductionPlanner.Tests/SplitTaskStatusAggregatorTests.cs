using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class SplitTaskStatusAggregatorTests
{
    private static ProductionTask Parent(bool isSplit = true) => new()
    {
        Id = 1,
        IsSplitTask = isSplit,
        Status = JobStatus.Assigned
    };

    private static ProductionTask Child(string employee, JobStatus status) => new()
    {
        EmployeeName = employee,
        Status = status,
        IsSplitTask = true,
        ParentRowNumber = 1
    };

    [Fact]
    public void NonSplitParent_UsesParentStatus()
    {
        var parent = Parent(isSplit: false);
        parent.Status = JobStatus.InProgress;

        var (statusText, hasSubtask) = SplitTaskStatusAggregator.Aggregate(parent, null, "Дима");

        Assert.Equal("Начал", statusText);
        Assert.False(hasSubtask);
    }

    [Fact]
    public void AllChildrenCompleted_ShowsGotovo()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Completed),
            Child("Яромир", JobStatus.Completed)
        };

        var (statusText, _) = SplitTaskStatusAggregator.Aggregate(parent, children, "Дима");

        Assert.Equal("Готово", statusText);
    }

    [Fact]
    public void SomeChildrenStarted_ShowsNachal()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Assigned),
            Child("Яромир", JobStatus.InProgress)
        };

        var (statusText, _) = SplitTaskStatusAggregator.Aggregate(parent, children, "Дима");

        Assert.Equal("Начал", statusText);
    }

    [Fact]
    public void NoChildrenStarted_ShowsNaznachena()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Assigned),
            Child("Яромир", JobStatus.Assigned)
        };

        var (statusText, _) = SplitTaskStatusAggregator.Aggregate(parent, children, "Дима");

        Assert.Equal("Назначена", statusText);
    }

    [Fact]
    public void TargetEmployeeHasActiveChild_HasCurrentUserSubtask()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.InProgress),
            Child("Яромир", JobStatus.Assigned)
        };

        var (_, hasSubtask) = SplitTaskStatusAggregator.Aggregate(parent, children, "Дима");

        Assert.True(hasSubtask);
    }

    [Fact]
    public void TargetEmployeeChildCompleted_NoSubtaskFlag()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Completed),
            Child("Яромир", JobStatus.InProgress)
        };

        var (_, hasSubtask) = SplitTaskStatusAggregator.Aggregate(parent, children, "Дима");

        Assert.False(hasSubtask);
    }
}
