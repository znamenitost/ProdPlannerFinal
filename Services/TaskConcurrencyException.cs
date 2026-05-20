namespace ProductionPlanner.Services;

/// <summary>
/// Задача была изменена другим запросом (гонка статуса или интервалов).
/// </summary>
public sealed class TaskConcurrencyException : Exception
{
    public TaskConcurrencyException(int taskId, string message)
        : base(message)
    {
        TaskId = taskId;
    }

    public int TaskId { get; }
}
