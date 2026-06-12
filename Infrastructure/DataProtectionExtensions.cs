using Microsoft.AspNetCore.DataProtection;

namespace ProductionPlanner.Infrastructure;

public static class DataProtectionExtensions
{
    public static IServiceCollection AddProductionPlannerDataProtection(this IServiceCollection services)
    {
        var keysPath = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "DataProtection-Keys");
        Directory.CreateDirectory(keysPath);

        var builder = services.AddDataProtection()
            .SetApplicationName("ProductionPlanner")
            .PersistKeysToFileSystem(new DirectoryInfo(keysPath));

        if (OperatingSystem.IsWindows())
            builder.ProtectKeysWithDpapi(protectToLocalMachine: true);

        return services;
    }
}
