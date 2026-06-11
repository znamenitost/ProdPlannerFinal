using ProductionPlanner.Hubs;

namespace ProductionPlanner.Tests;

public class NotificationConnectionRegistryTests
{
    [Fact]
    public void Register_and_unregister_keep_counters_balanced()
    {
        var registry = new NotificationConnectionRegistry { MaxConnectionsPerUser = 3 };

        registry.Register("user-1", "conn-a");
        registry.Register("user-1", "conn-b");
        registry.Unregister("user-1", "conn-a");

        var snapshot = registry.GetSnapshot();

        Assert.Equal(1, snapshot.ActiveTotal);
        Assert.Equal(2, snapshot.TotalOpened);
        Assert.Equal(1, snapshot.TotalClosed);
        Assert.Equal(0, snapshot.Balance);
        Assert.Equal(1, snapshot.ByUser["user-1"]);
    }

    [Fact]
    public void Register_evicts_oldest_when_over_limit_and_counts_close()
    {
        var registry = new NotificationConnectionRegistry { MaxConnectionsPerUser = 2 };

        registry.Register("user-1", "conn-1");
        registry.Register("user-1", "conn-2");
        var evicted = registry.Register("user-1", "conn-3");

        Assert.Single(evicted);
        Assert.DoesNotContain("conn-3", evicted);

        var snapshot = registry.GetSnapshot();
        Assert.Equal(2, snapshot.ActiveTotal);
        Assert.Equal(3, snapshot.TotalOpened);
        Assert.Equal(1, snapshot.TotalClosed);
        Assert.Equal(0, snapshot.Balance);
        Assert.Equal(2, snapshot.ByUser["user-1"]);
    }
}
