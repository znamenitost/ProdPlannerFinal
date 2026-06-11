namespace ProductionPlanner.Hubs;

public static class NotificationGroups
{
    public const string TableViewers = "table-viewers";

    private const string CalendarViewerPrefix = "calendar-viewers:";

    public static string ForCalendarViewer(string employeeFullName)
    {
        var trimmed = employeeFullName.Trim();
        return $"{CalendarViewerPrefix}{trimmed}";
    }

    public static bool IsCalendarViewerGroup(string groupName) =>
        groupName.StartsWith(CalendarViewerPrefix, StringComparison.Ordinal);
}
