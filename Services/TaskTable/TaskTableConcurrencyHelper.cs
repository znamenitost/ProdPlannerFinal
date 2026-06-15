using ProductionPlanner.Services;

namespace ProductionPlanner.Services.TaskTable;

public static class TaskTableConcurrencyHelper
{
    /// <summary>Сравнение метки версии строки (допуск на сериализацию JSON / БД).</summary>
    public static bool UpdatedAtMatches(DateTime stored, DateTime expected)
    {
        var a = NormalizeInstant(stored);
        var b = NormalizeInstant(expected);
        return Math.Abs((a - b).TotalSeconds) < 2;
    }

    public static void RequireExpectedUpdatedAt(int taskId, DateTime storedUpdatedAt, DateTime? expectedUpdatedAt)
    {
        if (!expectedUpdatedAt.HasValue)
            return;

        if (!UpdatedAtMatches(storedUpdatedAt, expectedUpdatedAt.Value))
        {
            throw new TaskConcurrencyException(
                taskId,
                "Задача была изменена другим действием. Обновите таблицу и повторите.");
        }
    }

    private static DateTime NormalizeInstant(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc)
            return value;

        return DateTime.SpecifyKind(value, DateTimeKind.Unspecified);
    }
}
