using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class TaskTableConcurrencyHelperTests
{
    [Fact]
    public void UpdatedAtMatches_allows_small_clock_skew()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        var expected = stored.AddMilliseconds(500);

        Assert.True(TaskTableConcurrencyHelper.UpdatedAtMatches(stored, expected));
    }

    [Fact]
    public void UpdatedAtMatches_rejects_stale_version()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        var expected = stored.AddSeconds(5);

        Assert.False(TaskTableConcurrencyHelper.UpdatedAtMatches(stored, expected));
    }

    [Fact]
    public void RequireExpectedUpdatedAt_skips_when_not_sent()
    {
        var ex = Record.Exception(() =>
            TaskTableConcurrencyHelper.RequireExpectedUpdatedAt(1, DateTime.UtcNow, null));

        Assert.Null(ex);
    }

    [Fact]
    public void RequireExpectedUpdatedAt_accepts_matching_version()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);

        var ex = Record.Exception(() =>
            TaskTableConcurrencyHelper.RequireExpectedUpdatedAt(7, stored, stored.AddMilliseconds(200)));

        Assert.Null(ex);
    }

    [Fact]
    public void RequireExpectedUpdatedAt_throws_on_mismatch()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        var expected = stored.AddMinutes(1);

        Assert.Throws<TaskConcurrencyException>(() =>
            TaskTableConcurrencyHelper.RequireExpectedUpdatedAt(42, stored, expected));
    }
}
