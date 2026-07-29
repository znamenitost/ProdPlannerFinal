using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class TaskTableConcurrencyHelperTests
{
    [Fact]
    public void UpdatedAtMatches_allows_serialization_noise()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        var expected = stored.AddTicks(5_000); // 0.5 мс — шум округления микросекунд/JSON

        Assert.True(TaskTableConcurrencyHelper.UpdatedAtMatches(stored, expected));
    }

    [Fact]
    public void UpdatedAtMatches_rejects_concurrent_save_within_two_seconds()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        var expected = stored.AddMilliseconds(200);

        Assert.False(TaskTableConcurrencyHelper.UpdatedAtMatches(stored, expected));
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
            TaskTableConcurrencyHelper.RequireExpectedUpdatedAt(7, stored, stored));

        Assert.Null(ex);
    }

    [Fact]
    public void RequireExpectedUpdatedAt_throws_on_fast_concurrent_save()
    {
        var stored = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        var expected = stored.AddMilliseconds(500);

        Assert.Throws<TaskConcurrencyException>(() =>
            TaskTableConcurrencyHelper.RequireExpectedUpdatedAt(7, stored, expected));
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
