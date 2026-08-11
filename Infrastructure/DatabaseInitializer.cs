using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Services.Catalog;

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

        try
        {
            await CatalogSeedService.SeedIfEmptyAsync(db, logger);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Не удалось заполнить демо-каталог");
        }

        try
        {
            var comments = scope.ServiceProvider.GetRequiredService<ITaskCommentService>();
            await comments.RebuildStaleBaselinePreviewsAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Не удалось пересобрать превью baseline-комментариев");
        }
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
            if (!columns.Contains("PickupCode"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN PickupCode TEXT NULL");
            if (!columns.Contains("PickedUpAt"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN PickedUpAt TEXT NULL");
            if (!columns.Contains("IssuedWithoutReady"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN IssuedWithoutReady INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("IsFuss"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN IsFuss INTEGER NOT NULL DEFAULT 0");

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
            await EnsureChatTablesSqliteAsync(connection, logger);
            await EnsureTaskCommentsTableSqliteAsync(connection, logger);
            await EnsureTaskCommentReadStatesSqliteAsync(connection, logger);
            await EnsureCustomerOrderTrackingsSqliteAsync(connection, logger);
            await EnsurePrintJobsSqliteAsync(connection, logger);
            await EnsureWebPushSubscriptionsSqliteAsync(connection, logger);
            await EnsureCatalogTablesSqliteAsync(connection, logger);
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

    private static async Task EnsureChatTablesSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS ChatConversations (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Type INTEGER NOT NULL,
                UserIdLow TEXT NULL,
                UserIdHigh TEXT NULL,
                CreatedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_ChatConversations_Type
                ON ChatConversations(Type);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_ChatConversations_UserIdLow_UserIdHigh
                ON ChatConversations(UserIdLow, UserIdHigh);

            CREATE TABLE IF NOT EXISTS ChatMessages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ConversationId INTEGER NOT NULL,
                SenderUserId TEXT NOT NULL,
                Text TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                EditedAt TEXT NULL,
                ReplyToMessageId INTEGER NULL,
                FOREIGN KEY (ConversationId) REFERENCES ChatConversations(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_ChatMessages_ConversationId_Id
                ON ChatMessages(ConversationId, Id);

            CREATE TABLE IF NOT EXISTS ChatReadStates (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId TEXT NOT NULL,
                ConversationId INTEGER NOT NULL,
                LastReadMessageId INTEGER NOT NULL,
                UpdatedAt TEXT NOT NULL,
                FOREIGN KEY (ConversationId) REFERENCES ChatConversations(Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_ChatReadStates_UserId_ConversationId
                ON ChatReadStates(UserId, ConversationId);

            CREATE TABLE IF NOT EXISTS ChatAttachments (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                MessageId INTEGER NOT NULL,
                FileName TEXT NOT NULL,
                ContentType TEXT NOT NULL,
                SizeBytes INTEGER NOT NULL,
                StoragePath TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                FOREIGN KEY (MessageId) REFERENCES ChatMessages(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_ChatAttachments_MessageId
                ON ChatAttachments(MessageId);
            """;
        await cmd.ExecuteNonQueryAsync();

        // Existing DBs created before EditedAt — add column if missing.
        var chatMessageColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var info = connection.CreateCommand())
        {
            info.CommandText = "PRAGMA table_info(ChatMessages)";
            using var reader = await info.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                chatMessageColumns.Add(reader.GetString(1));
        }

        if (!chatMessageColumns.Contains("EditedAt"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE ChatMessages ADD COLUMN EditedAt TEXT NULL";
            await alter.ExecuteNonQueryAsync();
        }

        if (!chatMessageColumns.Contains("ReplyToMessageId"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE ChatMessages ADD COLUMN ReplyToMessageId INTEGER NULL";
            await alter.ExecuteNonQueryAsync();
        }

        logger.LogInformation("Таблицы чата проверены/созданы.");
    }

    private static async Task EnsureTaskCommentsTableSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var create = connection.CreateCommand();
        create.CommandText = """
            CREATE TABLE IF NOT EXISTS TaskComments (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductionTaskId INTEGER NOT NULL,
                AuthorUserId TEXT NOT NULL,
                AuthorName TEXT NOT NULL,
                AuthorIsAdmin INTEGER NOT NULL,
                Text TEXT NOT NULL,
                RecipientUserId TEXT NULL,
                RecipientName TEXT NULL,
                ReplyToCommentId INTEGER NULL,
                IsBaseline INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL,
                FOREIGN KEY (ProductionTaskId) REFERENCES ProductionTasks(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_TaskComments_ProductionTaskId_Id
                ON TaskComments(ProductionTaskId, Id);
            """;
        await create.ExecuteNonQueryAsync();

        var commentColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var info = connection.CreateCommand())
        {
            info.CommandText = "PRAGMA table_info(TaskComments)";
            using var reader = await info.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                commentColumns.Add(reader.GetString(1));
        }

        if (!commentColumns.Contains("IsBaseline"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE TaskComments ADD COLUMN IsBaseline INTEGER NOT NULL DEFAULT 0";
            await alter.ExecuteNonQueryAsync();
        }

        using var migrate = connection.CreateCommand();
        migrate.CommandText = """
            INSERT INTO TaskComments (
                ProductionTaskId,
                AuthorUserId,
                AuthorName,
                AuthorIsAdmin,
                Text,
                RecipientUserId,
                RecipientName,
                ReplyToCommentId,
                IsBaseline,
                CreatedAt
            )
            SELECT
                t.Id,
                COALESCE(
                    (
                        SELECT u.Id
                        FROM Users u
                        WHERE u.Role = 'Admin' AND u.IsActive = 1
                        ORDER BY u.CreatedAt
                        LIMIT 1
                    ),
                    ''
                ),
                COALESCE(
                    (
                        SELECT u.FullName
                        FROM Users u
                        WHERE u.Role = 'Admin' AND u.IsActive = 1
                        ORDER BY u.CreatedAt
                        LIMIT 1
                    ),
                    'Админ'
                ),
                1,
                TRIM(t.Comment),
                NULL,
                NULL,
                NULL,
                1,
                COALESCE(t.CreatedAt, datetime('now'))
            FROM ProductionTasks t
            WHERE TRIM(COALESCE(t.Comment, '')) <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM TaskComments c WHERE c.ProductionTaskId = t.Id
              );
            """;
        var inserted = await migrate.ExecuteNonQueryAsync();

        using var markBaseline = connection.CreateCommand();
        markBaseline.CommandText = """
            UPDATE TaskComments
            SET IsBaseline = 1
            WHERE Id IN (
                SELECT MIN(Id)
                FROM TaskComments
                GROUP BY ProductionTaskId
            )
            AND IFNULL(RecipientUserId, '') = ''
            AND ReplyToCommentId IS NULL;
            """;
        var baselineMarked = await markBaseline.ExecuteNonQueryAsync();
        logger.LogInformation(
            "Таблица TaskComments проверена/создана. Мигрировано: {Count}, baseline: {Baseline}.",
            inserted,
            baselineMarked);
    }

    private static async Task EnsureTaskCommentReadStatesSqliteAsync(
        System.Data.Common.DbConnection connection,
        ILogger logger)
    {
        using var create = connection.CreateCommand();
        create.CommandText = """
            CREATE TABLE IF NOT EXISTS TaskCommentReadStates (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId TEXT NOT NULL,
                ProductionTaskId INTEGER NOT NULL,
                LastReadCommentId INTEGER NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_TaskCommentReadStates_UserId_ProductionTaskId
                ON TaskCommentReadStates(UserId, ProductionTaskId);
            """;
        await create.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица TaskCommentReadStates проверена/создана.");
    }

    private static async Task EnsureCustomerOrderTrackingsSqliteAsync(
        System.Data.Common.DbConnection connection,
        ILogger logger)
    {
        using var create = connection.CreateCommand();
        create.CommandText = """
            CREATE TABLE IF NOT EXISTS CustomerOrderTrackings (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CustomerKey TEXT NOT NULL,
                CustomerDisplayName TEXT NOT NULL,
                PublicToken TEXT NOT NULL,
                CreatedAt TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CustomerOrderTrackings_CustomerKey
                ON CustomerOrderTrackings(CustomerKey);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CustomerOrderTrackings_PublicToken
                ON CustomerOrderTrackings(PublicToken);
            """;
        await create.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица CustomerOrderTrackings проверена/создана.");
    }

    private static async Task EnsurePrintJobsSqliteAsync(
        System.Data.Common.DbConnection connection,
        ILogger logger)
    {
        using var create = connection.CreateCommand();
        create.CommandText = """
            CREATE TABLE IF NOT EXISTS PrintJobs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                TaskId INTEGER NOT NULL,
                OrderTitle TEXT NOT NULL,
                PrimaryComment TEXT NOT NULL DEFAULT '',
                PickupCode TEXT NOT NULL,
                Copies INTEGER NOT NULL DEFAULT 1,
                Status INTEGER NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL,
                ErrorMessage TEXT NULL,
                AgentName TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_PrintJobs_Status_CreatedAt
                ON PrintJobs(Status, CreatedAt);
            CREATE INDEX IF NOT EXISTS IX_PrintJobs_TaskId
                ON PrintJobs(TaskId);
            """;
        await create.ExecuteNonQueryAsync();

        // Existing DBs created before PrimaryComment
        using var info = connection.CreateCommand();
        info.CommandText = "PRAGMA table_info(PrintJobs)";
        using var reader = await info.ExecuteReaderAsync();
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (await reader.ReadAsync())
            columns.Add(reader.GetString(1));
        await reader.CloseAsync();

        if (!columns.Contains("PrimaryComment"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE PrintJobs ADD COLUMN PrimaryComment TEXT NOT NULL DEFAULT ''";
            await alter.ExecuteNonQueryAsync();
        }

        if (!columns.Contains("Copies"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE PrintJobs ADD COLUMN Copies INTEGER NOT NULL DEFAULT 1";
            await alter.ExecuteNonQueryAsync();
        }

        if (!columns.Contains("JobType"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE PrintJobs ADD COLUMN JobType INTEGER NOT NULL DEFAULT 0";
            await alter.ExecuteNonQueryAsync();
        }

        if (!columns.Contains("Line1"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE PrintJobs ADD COLUMN Line1 TEXT NOT NULL DEFAULT ''";
            await alter.ExecuteNonQueryAsync();
        }

        if (!columns.Contains("Line2"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE PrintJobs ADD COLUMN Line2 TEXT NOT NULL DEFAULT ''";
            await alter.ExecuteNonQueryAsync();
        }

        if (!columns.Contains("Line3"))
        {
            using var alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE PrintJobs ADD COLUMN Line3 TEXT NOT NULL DEFAULT ''";
            await alter.ExecuteNonQueryAsync();
        }

        logger.LogInformation("Таблица PrintJobs проверена/создана.");
    }

    private static async Task EnsureWebPushSubscriptionsSqliteAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS WebPushSubscriptions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId TEXT NOT NULL,
                Endpoint TEXT NOT NULL,
                P256dh TEXT NOT NULL,
                Auth TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_WebPushSubscriptions_Endpoint
                ON WebPushSubscriptions(Endpoint);
            CREATE INDEX IF NOT EXISTS IX_WebPushSubscriptions_UserId
                ON WebPushSubscriptions(UserId);
            """;
        await cmd.ExecuteNonQueryAsync();
        logger.LogInformation("Таблица WebPushSubscriptions проверена/создана.");
    }

    private static async Task EnsureCatalogTablesSqliteAsync(
        System.Data.Common.DbConnection connection,
        ILogger logger)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS CatalogCategories (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Slug TEXT NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CatalogCategories_Slug ON CatalogCategories(Slug);

            CREATE TABLE IF NOT EXISTS CatalogProducts (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CategoryId INTEGER NULL,
                Slug TEXT NOT NULL,
                Name TEXT NOT NULL,
                Description TEXT NOT NULL DEFAULT '',
                TaskType TEXT NOT NULL DEFAULT 'Каталог',
                DefaultEstimateHours REAL NOT NULL DEFAULT 1,
                IsPublished INTEGER NOT NULL DEFAULT 1,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL,
                FOREIGN KEY (CategoryId) REFERENCES CatalogCategories(Id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CatalogProducts_Slug ON CatalogProducts(Slug);

            CREATE TABLE IF NOT EXISTS CatalogProductVariants (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductId INTEGER NOT NULL,
                Sku TEXT NOT NULL DEFAULT '',
                ColorName TEXT NOT NULL DEFAULT '',
                ColorHex TEXT NOT NULL DEFAULT '#CCCCCC',
                PreviewImageUrl TEXT NULL,
                IsAvailable INTEGER NOT NULL DEFAULT 1,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (ProductId) REFERENCES CatalogProducts(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_CatalogProductVariants_ProductId_Sku
                ON CatalogProductVariants(ProductId, Sku);

            CREATE TABLE IF NOT EXISTS CatalogProductImages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductId INTEGER NOT NULL,
                VariantId INTEGER NULL,
                Kind INTEGER NOT NULL DEFAULT 0,
                Url TEXT NOT NULL,
                Caption TEXT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (ProductId) REFERENCES CatalogProducts(Id) ON DELETE CASCADE,
                FOREIGN KEY (VariantId) REFERENCES CatalogProductVariants(Id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS CatalogPriceTiers (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductId INTEGER NOT NULL,
                MinQty INTEGER NOT NULL,
                MaxQty INTEGER NULL,
                PricePerUnit TEXT NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (ProductId) REFERENCES CatalogProducts(Id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS CatalogArtworkZones (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductId INTEGER NOT NULL,
                Name TEXT NOT NULL DEFAULT 'Основная',
                BaseImageUrl TEXT NULL,
                MaskUrl TEXT NULL,
                MaterialUrl TEXT NULL,
                SpecularUrl TEXT NULL,
                MethodPreset TEXT NOT NULL DEFAULT 'uv',
                SpecsJson TEXT NOT NULL DEFAULT '[]',
                TemplateUrl TEXT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (ProductId) REFERENCES CatalogProducts(Id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS CatalogProductTabs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductId INTEGER NOT NULL,
                Type INTEGER NOT NULL DEFAULT 0,
                Label TEXT NOT NULL DEFAULT '',
                IsEnabled INTEGER NOT NULL DEFAULT 1,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (ProductId) REFERENCES CatalogProducts(Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CatalogProductTabs_ProductId_Type
                ON CatalogProductTabs(ProductId, Type);

            CREATE TABLE IF NOT EXISTS CatalogOrders (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                PublicNumber TEXT NOT NULL DEFAULT '',
                Status INTEGER NOT NULL DEFAULT 0,
                CustomerName TEXT NOT NULL,
                Phone TEXT NULL,
                Telegram TEXT NULL,
                Email TEXT NULL,
                Comment TEXT NOT NULL DEFAULT '',
                TotalAmount TEXT NOT NULL DEFAULT '0',
                DesiredDeadline TEXT NULL,
                CreatedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_CatalogOrders_PublicNumber ON CatalogOrders(PublicNumber);

            CREATE TABLE IF NOT EXISTS CatalogOrderLines (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                OrderId INTEGER NOT NULL,
                ProductId INTEGER NOT NULL,
                VariantId INTEGER NOT NULL,
                Quantity INTEGER NOT NULL,
                UnitPrice TEXT NOT NULL,
                LineTotal TEXT NOT NULL,
                ProductNameSnapshot TEXT NOT NULL DEFAULT '',
                ColorNameSnapshot TEXT NOT NULL DEFAULT '',
                SkuSnapshot TEXT NOT NULL DEFAULT '',
                MockupTransformJson TEXT NULL,
                LogoFileUrl TEXT NULL,
                ProductionTaskId INTEGER NULL,
                FOREIGN KEY (OrderId) REFERENCES CatalogOrders(Id) ON DELETE CASCADE,
                FOREIGN KEY (ProductId) REFERENCES CatalogProducts(Id) ON DELETE RESTRICT,
                FOREIGN KEY (VariantId) REFERENCES CatalogProductVariants(Id) ON DELETE RESTRICT,
                FOREIGN KEY (ProductionTaskId) REFERENCES ProductionTasks(Id) ON DELETE SET NULL
            );
            """;
        await cmd.ExecuteNonQueryAsync();
        logger.LogInformation("Таблицы каталога проверены/созданы (SQLite).");
    }
}
