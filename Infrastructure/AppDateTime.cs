namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Согласование времени: AppTimeService.Now — московская стенка (Unspecified);
/// timestamptz из БД: Unspecified трактуем как московскую стенку (симметрично PostgresDateTime.ToUtc при записи).
/// Сравнения дедлайнов — в UTC; рабочие часы 10–19 — в московской стенке.
/// </summary>
public static class AppDateTime
{
    private static readonly TimeZoneInfo Moscow = PostgresDateTime.GetMoscowTimeZone();

    /// <summary>Московское «сейчас» из AppTimeService → UTC.</summary>
    public static DateTime AppNowToUtc(DateTime appNow) => PostgresDateTime.ToUtc(appNow);

    /// <summary>Значение timestamptz из EF (legacy) → UTC.</summary>
    public static DateTime DbToUtc(DateTime dbValue) =>
        dbValue.Kind switch
        {
            DateTimeKind.Utc => dbValue,
            DateTimeKind.Local => dbValue.ToUniversalTime(),
            _ => PostgresDateTime.ToUtc(dbValue)
        };

    public static DateTime ToMoscowWallClockFromApp(DateTime appNow) =>
        TimeZoneInfo.ConvertTimeFromUtc(AppNowToUtc(appNow), Moscow);

    public static DateTime ToMoscowWallClockFromDb(DateTime dbValue) =>
        TimeZoneInfo.ConvertTimeFromUtc(DbToUtc(dbValue), Moscow);

    public static int CompareDeadlineToAppNow(DateTime deadlineFromDb, DateTime appNow) =>
        DbToUtc(deadlineFromDb).CompareTo(AppNowToUtc(appNow));

    /// <summary>Нет дедлайна — не просрочен (сравнение как «после сейчас»).</summary>
    public static int CompareDeadlineToAppNow(DateTime? deadlineFromDb, DateTime appNow) =>
        deadlineFromDb.HasValue ? CompareDeadlineToAppNow(deadlineFromDb.Value, appNow) : 1;
}
