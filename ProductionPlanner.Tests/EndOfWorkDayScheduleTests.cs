using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class EndOfWorkDayScheduleTests
{
    [Theory]
    [InlineData(2026, 6, 3, 18, 59, false)]
    [InlineData(2026, 6, 3, 19, 0, true)]
    [InlineData(2026, 6, 3, 22, 30, true)]
    [InlineData(2026, 6, 6, 19, 0, false)]
    [InlineData(2026, 6, 7, 19, 0, false)]
    public void ShouldRunEndOfDayClose_respects_weekday_and_19_00(
        int year, int month, int day, int hour, int minute, bool expected)
    {
        var moscowNow = new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Unspecified);
        Assert.Equal(expected, EndOfWorkDaySchedule.ShouldRunEndOfDayClose(moscowNow));
    }

    [Fact]
    public void GetWorkDayEnd_returns_19_00_same_calendar_day()
    {
        var moscowNow = new DateTime(2026, 6, 3, 20, 15, 0, DateTimeKind.Unspecified);
        Assert.Equal(new DateTime(2026, 6, 3, 19, 0, 0), EndOfWorkDaySchedule.GetWorkDayEnd(moscowNow));
    }

    [Theory]
    [InlineData(2026, 6, 3, 12, 0, 2026, 6, 3, 18, 59, false)]
    [InlineData(2026, 6, 3, 12, 0, 2026, 6, 3, 19, 0, true)]
    [InlineData(2026, 6, 3, 12, 0, 2026, 6, 4, 10, 0, true)]
    [InlineData(2026, 6, 5, 18, 30, 2026, 6, 6, 11, 0, true)]
    public void IsOpenLunchPastWorkDayEnd_closes_after_19_00_of_start_day(
        int sy, int sm, int sd, int sh, int smin,
        int ny, int nm, int nd, int nh, int nmin,
        bool expected)
    {
        var lunchStart = new DateTime(sy, sm, sd, sh, smin, 0, DateTimeKind.Unspecified);
        var now = new DateTime(ny, nm, nd, nh, nmin, 0, DateTimeKind.Unspecified);
        Assert.Equal(expected, EndOfWorkDaySchedule.IsOpenLunchPastWorkDayEnd(lunchStart, now));
    }
}
