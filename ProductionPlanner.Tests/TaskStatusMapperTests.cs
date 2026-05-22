using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class TaskStatusMapperTests
{
    [Theory]
    [InlineData(JobStatus.Assigned, "Назначена")]
    [InlineData(JobStatus.InProgress, "Начал")]
    [InlineData(JobStatus.Paused, "Пауза")]
    [InlineData(JobStatus.Completed, "Готово")]
    public void ToText_MapsKnownStatuses(JobStatus status, string expected)
    {
        Assert.Equal(expected, TaskStatusMapper.ToText(status));
    }

    [Theory]
    [InlineData("Готово", JobStatus.Completed)]
    [InlineData("Начал", JobStatus.InProgress)]
    [InlineData("Пауза", JobStatus.Paused)]
    [InlineData("", JobStatus.Assigned)]
    [InlineData("Назначена", JobStatus.Assigned)]
    public void FromText_MapsKnownLabels(string text, JobStatus expected)
    {
        Assert.Equal(expected, TaskStatusMapper.FromText(text));
    }
}
