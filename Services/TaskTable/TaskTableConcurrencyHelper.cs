using ProductionPlanner.Services;

namespace ProductionPlanner.Services.TaskTable;

public static class TaskTableConcurrencyHelper
{
    /// <summary>
    /// Допуск на шум представления версии: PostgreSQL timestamptz хранит микросекунды
    /// (значение в памяти до записи — 100 нс тики), плюс сериализация JSON.
    /// Реальные параллельные правки разнесены минимум на десятки миллисекунд,
    /// поэтому окно в 1 мс их не маскирует, а шум округления поглощает.
    /// </summary>
    public const double VersionToleranceMs = 1.0;

    /// <summary>Сравнение метки версии строки (допуск на сериализацию JSON / округление БД).</summary>
    public static bool UpdatedAtMatches(DateTime stored, DateTime expected)
    {
        var a = NormalizeInstant(stored);
        var b = NormalizeInstant(expected);
        return Math.Abs((a - b).TotalMilliseconds) < VersionToleranceMs;
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
