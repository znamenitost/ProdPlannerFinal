using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

public static class SchemaMigrationCli
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

        var postgres = configuration.GetConnectionString("DefaultConnection")
            ?? Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(postgres))
        {
            Console.Error.WriteLine(
                "Укажите PostgreSQL: ConnectionStrings:DefaultConnection или POSTGRES_CONNECTION_STRING");
            return 1;
        }

        postgres = PostgresConnectionHelper.Normalize(postgres);
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
        var logger = loggerFactory.CreateLogger("SchemaMigrationCli");

        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options =>
            options
                .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
                .UseNpgsql(postgres, npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3)));
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        try
        {
            await PostgresSchemaMigrator.ApplyAsync(db, logger);
            Console.WriteLine("OK: схема PostgreSQL обновлена.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Ошибка миграции: {ex}");
            logger.LogError(ex, "apply-migrations failed");
            return 1;
        }
    }
}
