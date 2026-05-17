namespace ProductionPlanner.Services.Calendar;

public static class WeekCalendarDateHelper
{
    public static DateTime GetMondayOfWeek(DateTime date)
    {
        var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-diff).Date;
    }

    public static DateTime ResolveWeekStart(string? startDate, DateTime currentTime)
    {
        if (!string.IsNullOrEmpty(startDate) &&
            DateTime.TryParseExact(startDate, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeLocal, out var parsed))
        {
            return GetMondayOfWeek(parsed);
        }

        return GetMondayOfWeek(currentTime);
    }
}
