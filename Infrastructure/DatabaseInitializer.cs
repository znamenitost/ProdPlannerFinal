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

        if (db.Database.IsNpgsql())
        {
            var connHint = PostgresConnectionHelper.Mask(db.Database.GetConnectionString() ?? "");
            try
            {
                await db.Database.OpenConnectionAsync();
                await db.Database.CloseConnectionAsync();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    $"Не удалось подключиться к PostgreSQL ({connHint}). " +
                    "Проверьте секрет POSTGRES_CONNECTION_STRING (Database и Username из панели 1gb, SSL Mode=Disable). " +
                    $"Причина: {ex.Message}",
                    ex);
            }

            logger.LogInformation("Подключение к PostgreSQL установлено.");
        }

        if (db.Database.IsNpgsql())
        {
            logger.LogInformation(
                "PostgreSQL: миграции при старте отключены. При деплое выполняйте: dotnet run -- apply-migrations");
        }
        else
        {
            var created = await db.Database.EnsureCreatedAsync();
            logger.LogInformation(created ? "База SQLite создана." : "База SQLite уже существует.");
            await ApplySqliteSchemaPatchesAsync(db, logger);
        }

        await IdentitySeedService.SeedAsync(scope.ServiceProvider);
    }

    private static async Task ApplySqliteSchemaPatchesAsync(ApplicationDbContext db, ILogger logger)
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
            if (!columns.Contains("SupplyMode"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN SupplyMode INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("HiddenFromTaskTable"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN HiddenFromTaskTable INTEGER NOT NULL DEFAULT 0");

            foreach (var alterCmd in alterCommands)
            {
                using var alterCommand = connection.CreateCommand();
                alterCommand.CommandText = alterCmd;
                await alterCommand.ExecuteNonQueryAsync();
                logger.LogInformation("Выполнен ALTER: {Command}", alterCmd);
            }

            await ApplyTaskSplitsSchemaPatchesAsync(connection, logger);
            await EnsureUserNotificationsTableSqliteAsync(connection, logger);
            await connection.CloseAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы SQLite");
        }
    }

    private static async Task ApplyTaskSplitsSchemaPatchesAsync(
        System.Data.Common.DbConnection connection,
        ILogger logger)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "PRAGMA table_info(TaskSplits)";
        using var reader = await cmd.ExecuteReaderAsync();
        var columns = new HashSet<string>();
        while (await reader.ReadAsync())
            columns.Add(reader.GetString(1));
        await reader.CloseAsync();

        if (!columns.Contains("SequenceOrder"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE TaskSplits ADD COLUMN SequenceOrder INTEGER NOT NULL DEFAULT 0";
            await alter.ExecuteNonQueryAsync();
            logger.LogInformation("Выполнен ALTER TaskSplits: SequenceOrder");
        }
    }

    private static async Task EnsureUserNotificationsTableSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var createNotifications = connection.CreateCommand();
        createNotifications.CommandText = """
            CREATE TABLE IF NOT EXISTS UserNotifications (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId TEXT NOT NULL,
                Type TEXT NOT NULL,
                TaskId INTEGER,
                Title TEXT NOT NULL,
                Deadline TEXT,
                CreatedAt TEXT NOT NULL,
                AcknowledgedAt TEXT
            );
            CREATE INDEX IF NOT EXISTS IX_UserNotifications_UserId_Ack
                ON UserNotifications(UserId, AcknowledgedAt);
            """;
        await createNotifications.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица UserNotifications проверена/создана.");
    }
}
