using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class EmployeeAssignmentLoadServiceTests
{
    [Theory]
    [InlineData(JobStatus.Assigned, true)]
    [InlineData(JobStatus.InProgress, true)]
    [InlineData(JobStatus.Paused, true)]
    [InlineData(JobStatus.Approved, true)]
    [InlineData(JobStatus.InStock, true)]
    [InlineData(JobStatus.PendingApproval, false)]
    [InlineData(JobStatus.NoItems, false)]
    [InlineData(JobStatus.Waiting, false)]
    public void IsCountableForAssignmentLoad_RespectsBlockedStatuses(JobStatus status, bool expected)
    {
        var task = new ProductionTask { Status = status };

        Assert.Equal(expected, EmployeeAssignmentLoadService.IsCountableForAssignmentLoad(task));
    }
}
