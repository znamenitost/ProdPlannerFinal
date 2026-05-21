using System.Runtime.Versioning;

namespace ProductionPlanner.Infrastructure;

public static class WindowsEventLogConfigurator
{
    public static void ConfigureIfSupported(WebApplicationBuilder builder, bool isDevelopment)
    {
        if (!OperatingSystem.IsWindows() || isDevelopment)
            return;

        AddEventLog(builder);
    }

    [SupportedOSPlatform("windows")]
    private static void AddEventLog(WebApplicationBuilder builder)
    {
        builder.Logging.AddEventLog(settings =>
        {
            settings.SourceName = "ProductionPlanner";
            settings.LogName = "Application";
        });
    }
}
