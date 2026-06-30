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
    public void OnlyPausedAndNotStartedChildren_ShowsPauza()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Paused),
            Child("Яромир", JobStatus.Assigned),
            Child("Олег", JobStatus.Waiting)
        };

        var (statusText, _) = SplitTaskStatusAggregator.Aggregate(parent, children, "Дима");

        Assert.Equal("Пауза", statusText);
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

    [Theory]
    [InlineData(JobStatus.Approved)]
    [InlineData(JobStatus.InStock)]
    public void ResolvedInfoStatusWithoutWork_DoesNotStartParent(JobStatus childStatus)
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", childStatus),
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

    [Fact]
    public void SingleActiveChildPaused_ShowsPauza()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Completed),
            Child("Яромир", JobStatus.Paused)
        };

        var (statusText, _) = SplitTaskStatusAggregator.Aggregate(parent, children, "Яромир");

        Assert.Equal("Пауза", statusText);
    }

    [Theory]
    [InlineData(JobStatus.Paused, JobStatus.Paused)]
    [InlineData(JobStatus.InProgress, JobStatus.InProgress)]
    [InlineData(JobStatus.Assigned, JobStatus.Assigned)]
    public void ResolveParentStatus_WithSingleActiveChild_MirrorsChildStatus(
        JobStatus childStatus,
        JobStatus expectedParentStatus)
    {
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Completed),
            Child("Яромир", childStatus)
        };

        var resolved = SplitTaskStatusAggregator.ResolveParentStatus(children);

        Assert.Equal(expectedParentStatus, resolved);
    }

    [Fact]
    public void ResolveParentStatus_WithSingleRemainingChild_MirrorsChildStatus()
    {
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Paused)
        };

        var resolved = SplitTaskStatusAggregator.ResolveParentStatus(children);

        Assert.Equal(JobStatus.Paused, resolved);
    }

    [Fact]
    public void AggregatePriorityMarked_false_when_parent_and_children_unmarked()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Assigned),
            Child("Яромир", JobStatus.InProgress)
        };

        Assert.False(SplitTaskStatusAggregator.AggregatePriorityMarked(parent, children));
    }

    [Fact]
    public void AggregatePriorityMarked_true_when_any_child_marked()
    {
        var parent = Parent();
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Assigned) { IsPriorityMarked = true },
            Child("Яромир", JobStatus.InProgress)
        };

        Assert.True(SplitTaskStatusAggregator.AggregatePriorityMarked(parent, children));
    }

    [Fact]
    public void AggregatePriorityMarked_true_when_parent_marked()
    {
        var parent = Parent();
        parent.IsPriorityMarked = true;
        var children = new List<ProductionTask>
        {
            Child("Дима", JobStatus.Assigned)
        };

        Assert.True(SplitTaskStatusAggregator.AggregatePriorityMarked(parent, children));
    }

    [Fact]
    public void AggregatePriorityMarked_uses_parent_flag_when_children_not_loaded()
    {
        var parent = Parent();
        parent.IsPriorityMarked = true;

        Assert.True(SplitTaskStatusAggregator.AggregatePriorityMarked(parent, null));
    }
}
