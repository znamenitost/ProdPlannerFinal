namespace ProductionPlanner.Services;

/// <summary>
/// Когда запускать автозакрытие интервалов (московское время, пн–пт, с 19:00).
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
}
