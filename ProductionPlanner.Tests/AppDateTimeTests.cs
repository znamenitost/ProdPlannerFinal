using ProductionPlanner.Infrastructure;
using Xunit;

namespace ProductionPlanner.Tests;

public class AppDateTimeTests
{
    [Fact]
    public void AppNowToUtc_matches_PostgresDateTime_ToUtc()
    {
        var appNow = new DateTime(2026, 5, 23, 12, 0, 0, DateTimeKind.Unspecified);
        Assert.Equal(PostgresDateTime.ToUtc(appNow), AppDateTime.AppNowToUtc(appNow));
    }

    [Fact]
    public void DbToUtc_treats_unspecified_as_moscow_wall_clock()
    {
        var dbValue = new DateTime(2026, 5, 23, 15, 0, 0, DateTimeKind.Unspecified);
        Assert.Equal(PostgresDateTime.ToUtc(dbValue), AppDateTime.DbToUtc(dbValue));
    }

    [Fact]
    public void ToMoscowWallClockFromApp_preserves_moscow_hours()
    {
        var appNow = new DateTime(2026, 5, 23, 15, 30, 0, DateTimeKind.Unspecified);
        var moscow = AppDateTime.ToMoscowWallClockFromApp(appNow);

        Assert.Equal(15, moscow.Hour);
        Assert.Equal(30, moscow.Minute);
        Assert.Equal(DateTimeKind.Unspecified, moscow.Kind);
    }

    [Fact]
    public void CompareDeadlineToAppNow_uses_utc_instant()
    {
        var appNow = new DateTime(2026, 5, 23, 12, 0, 0, DateTimeKind.Unspecified);
        var deadlineDb = new DateTime(2026, 5, 23, 11, 0, 0, DateTimeKind.Unspecified);

        Assert.True(AppDateTime.CompareDeadlineToAppNow(deadlineDb, appNow) < 0);
    }

    [Fact]
    public void ToMoscowWallClockFromDb_round_trips_moscow_wall_clock()
    {
        var moscowWall = new DateTime(2026, 5, 23, 14, 45, 0, DateTimeKind.Unspecified);
        var utc = PostgresDateTime.ToUtc(moscowWall);
        var roundTrip = AppDateTime.ToMoscowWallClockFromDb(
            DateTime.SpecifyKind(utc, DateTimeKind.Utc));

        Assert.Equal(moscowWall.Hour, roundTrip.Hour);
        Assert.Equal(moscowWall.Minute, roundTrip.Minute);
        Assert.Equal(moscowWall.Date, roundTrip.Date);
    }
}
