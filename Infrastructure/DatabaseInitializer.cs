using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

        var created = db.Database.EnsureCreated();
        logger.LogInformation(created ? "База данных создана." : "База данных уже существует.");

        await ApplySchemaPatchesAsync(db, logger);
        await IdentitySeedService.SeedAsync(scope.ServiceProvider);
    }

    private static async Task ApplySchemaPatchesAsync(ApplicationDbContext db, ILogger logger)
    {
        try
        {
            var connection = db.Database.GetDbConnection();
            await connection.OpenAsync();
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "PRAGMA table_info(ProductionTasks)";
            using var reader = await cmd.ExecuteReaderAsync();
            var columns = new HashSet<string>();
            while (await reader.ReadAsync())
                columns.Add(reader.GetString(1));

            var alterCommands = new List<string>();
            if (!columns.Contains("FolderPath"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN FolderPath TEXT NOT NULL DEFAULT ''");
            if (!columns.Contains("FileName"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN FileName TEXT NOT NULL DEFAULT ''");
            if (!columns.Contains("DisplayOrder"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN DisplayOrder INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("CreatedAt"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN CreatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'");
            if (!columns.Contains("UpdatedAt"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN UpdatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'");

            foreach (var alterCmd in alterCommands)
            {
                using var alterCommand = connection.CreateCommand();
                alterCommand.CommandText = alterCmd;
                await alterCommand.ExecuteNonQueryAsync();
                logger.LogInformation("Выполнен ALTER: {Command}", alterCmd);
            }

            await connection.CloseAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы БД");
        }
    }
}
