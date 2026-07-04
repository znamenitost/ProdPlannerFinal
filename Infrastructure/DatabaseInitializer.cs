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
            await PostgresSchemaMigrator.ApplyCompatibilityPatchesAsync(db, logger);
            logger.LogInformation(
                "PostgreSQL: проверка совместимости схемы выполнена. Полные EF-миграции: dotnet run -- apply-migrations");
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
            if (!columns.Contains("RequiresTestBeforeProduction"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN RequiresTestBeforeProduction INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("TestEstimateHours"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN TestEstimateHours REAL NOT NULL DEFAULT 0");
            if (!columns.Contains("ProductionEstimateHours"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN ProductionEstimateHours REAL NOT NULL DEFAULT 0");
            if (!columns.Contains("WorkPhase"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN WorkPhase INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("TestPhaseCompletedAt"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN TestPhaseCompletedAt TEXT NULL");
            if (!columns.Contains("IsPriorityMarked"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN IsPriorityMarked INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("CommentEditedViaDialog"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN CommentEditedViaDialog INTEGER NOT NULL DEFAULT 0");

            foreach (var alterCmd in alterCommands)
            {
                using var alterCommand = connection.CreateCommand();
                alterCommand.CommandText = alterCmd;
                await alterCommand.ExecuteNonQueryAsync();
                logger.LogInformation("Выполнен ALTER: {Command}", alterCmd);
            }

            await ApplyTaskSplitsSchemaPatchesAsync(connection, logger);
            await EnsureUserNotificationsTableSqliteAsync(connection, logger);
            await EnsureLunchIntervalsTableSqliteAsync(connection, logger);
            await EnsureTaskCdrPreviewsTableSqliteAsync(connection, logger);
            await EnsureAppSettingsTableSqliteAsync(connection, logger);
            await EnsureMaxMessengerTablesSqliteAsync(connection, logger);
            await ApplyPhase2PerformanceIndexesSqliteAsync(connection, logger);
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

        if (!columns.Contains("IsApprovalTestPart"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE TaskSplits ADD COLUMN IsApprovalTestPart INTEGER NOT NULL DEFAULT 0";
            await alter.ExecuteNonQueryAsync();
            logger.LogInformation("Выполнен ALTER TaskSplits: IsApprovalTestPart");
        }

        if (!columns.Contains("ApprovalGateTestChildId"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE TaskSplits ADD COLUMN ApprovalGateTestChildId INTEGER NULL";
            await alter.ExecuteNonQueryAsync();
            logger.LogInformation("Выполнен ALTER TaskSplits: ApprovalGateTestChildId");
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

    private static async Task ApplyPhase2PerformanceIndexesSqliteAsync(
        System.Data.Common.DbConnection connection,
        ILogger logger)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            CREATE INDEX IF NOT EXISTS IX_WorkIntervals_OpenInterval
                ON WorkIntervals(ProductionTaskId) WHERE EndTime IS NULL;
            CREATE INDEX IF NOT EXISTS IX_WorkIntervals_RangeLookup
                ON WorkIntervals(StartTime, EndTime);
            CREATE INDEX IF NOT EXISTS IX_ProductionTasks_EmployeeName_CompletedAt
                ON ProductionTasks(EmployeeName, CompletedAt) WHERE Status = 3;
            CREATE INDEX IF NOT EXISTS IX_ProductionTasks_RootTableVisible
                ON ProductionTasks(DisplayOrder DESC, Id DESC)
                WHERE ParentRowNumber IS NULL AND HiddenFromTaskTable = 0;
            CREATE INDEX IF NOT EXISTS IX_Users_FullName
                ON Users(FullName);
            """;
        await cmd.ExecuteNonQueryAsync();
        logger.LogInformation("Индексы производительности (phase 2) проверены/созданы (SQLite).");
    }

    private static async Task EnsureLunchIntervalsTableSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var createLunchIntervals = connection.CreateCommand();
        createLunchIntervals.CommandText = """
            CREATE TABLE IF NOT EXISTS LunchIntervals (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                EmployeeName TEXT NOT NULL,
                StartTime TEXT NOT NULL,
                EndTime TEXT
            );
            CREATE INDEX IF NOT EXISTS IX_LunchIntervals_EmployeeName_StartTime
                ON LunchIntervals(EmployeeName, StartTime);
            CREATE INDEX IF NOT EXISTS IX_LunchIntervals_EmployeeName_EndTime
                ON LunchIntervals(EmployeeName, EndTime);
            """;
        await createLunchIntervals.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица LunchIntervals проверена/создана.");
    }

    private static async Task EnsureTaskCdrPreviewsTableSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var createPreviews = connection.CreateCommand();
        createPreviews.CommandText = """
            CREATE TABLE IF NOT EXISTS TaskCdrPreviews (
                TaskId INTEGER NOT NULL PRIMARY KEY,
                ContentType TEXT NOT NULL DEFAULT 'image/webp',
                Data BLOB NOT NULL DEFAULT X'',
                ByteSize INTEGER NOT NULL DEFAULT 0,
                SourceKey TEXT NOT NULL DEFAULT '',
                UpdatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00',
                FOREIGN KEY (TaskId) REFERENCES ProductionTasks(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_TaskCdrPreviews_UpdatedAt
                ON TaskCdrPreviews(UpdatedAt);
            """;
        await createPreviews.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица TaskCdrPreviews проверена/создана.");
    }

    private static async Task EnsureAppSettingsTableSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var createSettings = connection.CreateCommand();
        createSettings.CommandText = """
            CREATE TABLE IF NOT EXISTS AppSettings (
                Key TEXT NOT NULL PRIMARY KEY,
                Json TEXT NOT NULL DEFAULT '{}',
                UpdatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'
            );
            """;
        await createSettings.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица AppSettings проверена/создана.");
    }

    private static async Task EnsureMaxMessengerTablesSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS UserMaxLinks (
                UserId TEXT NOT NULL PRIMARY KEY,
                MaxUserId INTEGER NOT NULL,
                IsActive INTEGER NOT NULL DEFAULT 1,
                LinkedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00',
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_UserMaxLinks_MaxUserId ON UserMaxLinks(MaxUserId);

            CREATE TABLE IF NOT EXISTS TaskMaxSubscriptions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId TEXT NOT NULL,
                TaskId INTEGER NOT NULL,
                CreatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_TaskMaxSubscriptions_UserId_TaskId
                ON TaskMaxSubscriptions(UserId, TaskId);
            CREATE INDEX IF NOT EXISTS IX_TaskMaxSubscriptions_TaskId ON TaskMaxSubscriptions(TaskId);

            CREATE TABLE IF NOT EXISTS MaxLinkTokens (
                Code TEXT NOT NULL PRIMARY KEY,
                UserId TEXT NOT NULL,
                ExpiresAt TEXT NOT NULL
            );
            """;
        await cmd.ExecuteNonQueryAsync();
        logger.LogInformation("Таблицы MAX Messenger проверены/созданы.");
    }
}
