namespace ProductionPlanner.Services;

/// <summary>
/// Когда запускать автозакрытие интервалов и обедов (московское время, пн–пт, с 19:00).
/// </summary>
public static class EndOfWorkDaySchedule
{
    public static readonly TimeSpan WorkDayEnd = new(19, 0, 0);

    public static bool ShouldRunEndOfDayClose(DateTime moscowNow)
    {
        if (moscowNow.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            return false;
        return moscowNow.TimeOfDay >= WorkDayEnd;
    }

    public static DateTime GetWorkDayEnd(DateTime moscowNow) =>
        moscowNow.Date + WorkDayEnd;

    /// <summary>
    /// Открытый обед считается просроченным после 19:00 дня его начала
    /// (в т.ч. на выходных / на следующий день — чтобы оверлей не «залипал»).
    /// </summary>
    public static bool IsOpenLunchPastWorkDayEnd(DateTime lunchStartMoscow, DateTime nowMoscow) =>
        nowMoscow >= GetWorkDayEnd(lunchStartMoscow);
}
