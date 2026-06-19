using ProductionPlanner.Hubs;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class TaskDataSyncHubBroadcasterTests
{
    [Fact]
    public void ResolveGroups_TaskStatusChanged_includes_table_and_calendar_viewers()
    {
        var groups = TaskDataSyncHubBroadcaster.ResolveGroups(
            "TaskStatusChanged",
            ["Яромир"]);

        Assert.Contains(NotificationGroups.TableViewers, groups);
        Assert.Contains(NotificationGroups.ForCalendarViewer("Яромир"), groups);
        Assert.Equal(2, groups.Count);
    }

    [Fact]
    public void ResolveGroups_TaskProgressChanged_includes_only_calendar_viewers()
    {
        var groups = TaskDataSyncHubBroadcaster.ResolveGroups(
            "TaskProgressChanged",
            ["Дима"]);

        Assert.DoesNotContain(NotificationGroups.TableViewers, groups);
        Assert.Contains(NotificationGroups.ForCalendarViewer("Дима"), groups);
    }

    [Fact]
    public void ResolveGroups_CdrPreviewRetryDue_includes_table_viewers()
    {
        var groups = TaskDataSyncHubBroadcaster.ResolveGroups(
            "CdrPreviewRetryDue",
            []);

        Assert.Single(groups);
        Assert.Equal(NotificationGroups.TableViewers, groups[0]);
    }

    [Fact]
    public void ResolveGroups_skips_empty_employee_names()
    {
        var groups = TaskDataSyncHubBroadcaster.ResolveGroups(
            "TaskUpdated",
            ["", "  "]);

        Assert.Single(groups);
        Assert.Equal(NotificationGroups.TableViewers, groups[0]);
    }
}
