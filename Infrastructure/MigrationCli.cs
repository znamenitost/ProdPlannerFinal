using Microsoft.Extensions.Configuration;

namespace ProductionPlanner.Infrastructure;

public static class MigrationCli
{
    public static async Task<int> RunAsync(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Production.json", optional: true)
            .AddJsonFile("appsettings.Production.local.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var sqlitePath = GetArgValue(args, "--sqlite")
            ?? Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "ProductionPlanner.db");
        var postgres = GetArgValue(args, "--postgres")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");
        var clear = args.Contains("--clear", StringComparer.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(postgres))
        {
            Console.Error.WriteLine(
                "Укажите PostgreSQL: --postgres \"Host=...\" или ConnectionStrings:DefaultConnection в appsettings.Production.local.json");
            return 1;
        }

        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
        var logger = loggerFactory.CreateLogger("MigrationCli");

        try
        {
            var count = await SqliteToPostgresMigrator.RunAsync(sqlitePath, postgres, clear, logger);
            Console.WriteLine($"OK: перенесено задач {count}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Ошибка переноса: {ex.Message}");
            logger.LogError(ex, "Migration failed");
            return 2;
        }
    }

    private static string? GetArgValue(string[] args, string key)
    {
        var index = Array.FindIndex(args, a => string.Equals(a, key, StringComparison.OrdinalIgnoreCase));
        if (index < 0 || index + 1 >= args.Length)
            return null;
        return args[index + 1];
    }
}
