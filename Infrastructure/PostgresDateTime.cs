namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Npgsql maps timestamptz parameters as UTC. App time is Moscow wall-clock (often Unspecified).
/// </summary>
public static class PostgresDateTime
{
    private static readonly TimeZoneInfo Moscow = CreateMoscowTimeZone();

    internal static TimeZoneInfo GetMoscowTimeZone() =>
        Moscow;

    private static TimeZoneInfo CreateMoscowTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Russian Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
        }
    }

    public static DateTime ToUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), Moscow)
        };
}
