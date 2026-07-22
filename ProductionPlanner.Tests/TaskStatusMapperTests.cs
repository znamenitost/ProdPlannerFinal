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
    [InlineData(JobStatus.PendingApproval, "Согласование")]
    [InlineData(JobStatus.NoItems, "Нет изделий")]
    [InlineData(JobStatus.Approved, "Согласовано")]
    [InlineData(JobStatus.InStock, "В наличии")]
    [InlineData(JobStatus.Waiting, "Ожидание")]
    public void ToText_MapsKnownStatuses(JobStatus status, string expected)
    {
        Assert.Equal(expected, TaskStatusMapper.ToText(status));
    }

    [Theory]
    [InlineData("Готово", JobStatus.Completed)]
    [InlineData("Выдан", JobStatus.Completed)]
    [InlineData("Начал", JobStatus.InProgress)]
    [InlineData("Пауза", JobStatus.Paused)]
    [InlineData("", JobStatus.Assigned)]
    [InlineData("Назначена", JobStatus.Assigned)]
    [InlineData("Суета", JobStatus.Assigned)]
    [InlineData("Согласование", JobStatus.PendingApproval)]
    [InlineData("На согласовании", JobStatus.PendingApproval)]
    [InlineData("Нет изделий", JobStatus.NoItems)]
    [InlineData("Согласовано", JobStatus.Approved)]
    [InlineData("В наличии", JobStatus.InStock)]
    [InlineData("Ожидание", JobStatus.Waiting)]
    public void FromText_MapsKnownLabels(string text, JobStatus expected)
    {
        Assert.Equal(expected, TaskStatusMapper.FromText(text));
    }

    [Fact]
    public void ApplyPickedUpDisplay_ReplacesStatusWhenPickedUp()
    {
        var task = new ProductionTask
        {
            Status = JobStatus.Completed,
            PickedUpAt = DateTime.UtcNow
        };

        Assert.Equal(
            TaskStatusMapper.PickedUpText,
            TaskStatusMapper.ApplyPickedUpDisplay(task, "Готово"));
        Assert.Equal(
            TaskStatusMapper.PickedUpText,
            TaskStatusMapper.ApplyPickedUpDisplay(task, "Начал"));
    }

    [Fact]
    public void ApplyPickedUpDisplay_KeepsCompletedWhenNotPickedUp()
    {
        var task = new ProductionTask { Status = JobStatus.Completed, PickedUpAt = null };
        Assert.Equal("Готово", TaskStatusMapper.ApplyPickedUpDisplay(task, "Готово"));
    }

    [Fact]
    public void ToDisplayText_FussAssigned_ShowsFussLabel()
    {
        var task = new ProductionTask { Status = JobStatus.Assigned, IsFuss = true };
        Assert.Equal(TaskStatusMapper.FussAssignedText, TaskStatusMapper.ToDisplayText(task));
    }

    [Fact]
    public void ToDisplayText_FussCompleted_ShowsCompleted()
    {
        var task = new ProductionTask { Status = JobStatus.Completed, IsFuss = true };
        Assert.Equal("Готово", TaskStatusMapper.ToDisplayText(task));
    }
}
