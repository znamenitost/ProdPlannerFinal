using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Применение EF-миграций и совместимости схемы PostgreSQL (деплой / CLI, не при каждом старте IIS).
/// </summary>
public static class PostgresSchemaMigrator
{
    public static async Task ApplyAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsNpgsql())
            throw new InvalidOperationException("PostgresSchemaMigrator вызывается только для PostgreSQL.");

        await db.Database.MigrateAsync(cancellationToken);
        logger.LogInformation("Схема PostgreSQL применена (EF migrations).");

        await ApplyCompatibilityPatchesAsync(db, logger, cancellationToken);
    }

    /// <summary>
    /// Идемпотентные ALTER/CREATE для колонок вне цепочки EF или если apply-migrations не запускался при деплое.
    /// </summary>
    public static async Task ApplyCompatibilityPatchesAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsNpgsql())
            return;

        await ApplyProductionTasksCompatibilityPatchAsync(db, logger, cancellationToken);
        await ApplyUserNotificationsPatchAsync(db, logger, cancellationToken);
        await ApplyLunchIntervalsPatchAsync(db, logger, cancellationToken);
        await ApplyTaskCdrPreviewsPatchAsync(db, logger, cancellationToken);
        await ApplyAppSettingsPatchAsync(db, logger, cancellationToken);
        await ApplyMaxMessengerPatchAsync(db, logger, cancellationToken);
        await ApplyChatTablesPatchAsync(db, logger, cancellationToken);
        await ApplyWebPushSubscriptionsPatchAsync(db, logger, cancellationToken);
        await ApplyPhase2PerformanceIndexesPatchAsync(db, logger, cancellationToken);
    }

    private static async Task ApplyProductionTasksCompatibilityPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "SupplyMode" integer NOT NULL DEFAULT 0;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "HiddenFromTaskTable" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "RequiresTestBeforeProduction" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "TestEstimateHours" double precision NOT NULL DEFAULT 0;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "ProductionEstimateHours" double precision NOT NULL DEFAULT 0;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "WorkPhase" integer NOT NULL DEFAULT 0;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "TestPhaseCompletedAt" timestamp with time zone NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "CdrPreviewRetryAt" timestamp with time zone NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "CdrPreviewRetryAttempts" integer NOT NULL DEFAULT 0;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "IsPriorityMarked" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "CommentEditedViaDialog" boolean NOT NULL DEFAULT false;

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_CdrPreviewRetryAt"
                    ON "ProductionTasks" ("CdrPreviewRetryAt");

                ALTER TABLE "TaskSplits"
                    ADD COLUMN IF NOT EXISTS "SequenceOrder" integer NOT NULL DEFAULT 0;

                ALTER TABLE "TaskSplits"
                    ADD COLUMN IF NOT EXISTS "IsApprovalTestPart" boolean NOT NULL DEFAULT false;

                ALTER TABLE "TaskSplits"
                    ADD COLUMN IF NOT EXISTS "ApprovalGateTestChildId" integer NULL;
                """, cancellationToken);
            logger.LogInformation("Колонки совместимости ProductionTasks/TaskSplits проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (ProductionTasks/TaskSplits)");
            throw;
        }
    }

    private static async Task ApplyUserNotificationsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "UserNotifications" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "UserId" text NOT NULL,
                    "Type" character varying(50) NOT NULL,
                    "TaskId" integer,
                    "Title" character varying(500) NOT NULL,
                    "Deadline" timestamp with time zone,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "AcknowledgedAt" timestamp with time zone
                );
                CREATE INDEX IF NOT EXISTS "IX_UserNotifications_UserId_AcknowledgedAt"
                    ON "UserNotifications" ("UserId", "AcknowledgedAt");
                """, cancellationToken);
            logger.LogInformation("Таблица UserNotifications проверена/создана (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (UserNotifications)");
            throw;
        }
    }

    private static async Task ApplyLunchIntervalsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "LunchIntervals" (
                    "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "EmployeeName" character varying(100) NOT NULL,
                    "StartTime" timestamp with time zone NOT NULL,
                    "EndTime" timestamp with time zone
                );
                CREATE INDEX IF NOT EXISTS "IX_LunchIntervals_EmployeeName_StartTime"
                    ON "LunchIntervals" ("EmployeeName", "StartTime");
                CREATE INDEX IF NOT EXISTS "IX_LunchIntervals_EmployeeName_EndTime"
                    ON "LunchIntervals" ("EmployeeName", "EndTime");
                """, cancellationToken);
            logger.LogInformation("Таблица LunchIntervals проверена/создана (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (LunchIntervals)");
            throw;
        }
    }

    private static async Task ApplyTaskCdrPreviewsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "TaskCdrPreviews" (
                    "TaskId" integer NOT NULL PRIMARY KEY,
                    "ContentType" character varying(64) NOT NULL DEFAULT 'image/webp',
                    "Data" bytea NOT NULL DEFAULT '\x'::bytea,
                    "ByteSize" integer NOT NULL DEFAULT 0,
                    "SourceKey" character varying(512) NOT NULL DEFAULT '',
                    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "FK_TaskCdrPreviews_ProductionTasks_TaskId"
                        FOREIGN KEY ("TaskId") REFERENCES "ProductionTasks" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_TaskCdrPreviews_UpdatedAt"
                    ON "TaskCdrPreviews" ("UpdatedAt");
                """, cancellationToken);
            logger.LogInformation("Таблица TaskCdrPreviews проверена/создана (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (TaskCdrPreviews)");
            throw;
        }
    }

    private static async Task ApplyAppSettingsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "AppSettings" (
                    "Key" character varying(128) NOT NULL PRIMARY KEY,
                    "Json" text NOT NULL DEFAULT '{{}}',
                    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
                );
                """, cancellationToken);
            logger.LogInformation("Таблица AppSettings проверена/создана (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (AppSettings)");
            throw;
        }
    }

    private static async Task ApplyMaxMessengerPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "UserMaxLinks" (
                    "UserId" character varying(450) NOT NULL PRIMARY KEY,
                    "MaxUserId" bigint NOT NULL,
                    "IsActive" boolean NOT NULL DEFAULT TRUE,
                    "LinkedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "FK_UserMaxLinks_Users_UserId"
                        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_UserMaxLinks_MaxUserId"
                    ON "UserMaxLinks" ("MaxUserId");

                CREATE TABLE IF NOT EXISTS "TaskMaxSubscriptions" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "UserId" character varying(450) NOT NULL,
                    "TaskId" integer NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TaskMaxSubscriptions_UserId_TaskId"
                    ON "TaskMaxSubscriptions" ("UserId", "TaskId");
                CREATE INDEX IF NOT EXISTS "IX_TaskMaxSubscriptions_TaskId"
                    ON "TaskMaxSubscriptions" ("TaskId");

                CREATE TABLE IF NOT EXISTS "MaxLinkTokens" (
                    "Code" character varying(32) NOT NULL PRIMARY KEY,
                    "UserId" character varying(450) NOT NULL,
                    "ExpiresAt" timestamp with time zone NOT NULL
                );
                """, cancellationToken);
            logger.LogInformation("Таблицы MAX Messenger проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (MAX Messenger)");
            throw;
        }
    }

    private static async Task ApplyChatTablesPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "ChatConversations" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "Type" integer NOT NULL,
                    "UserIdLow" character varying(450) NULL,
                    "UserIdHigh" character varying(450) NULL,
                    "CreatedAt" timestamp with time zone NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "IX_ChatConversations_Type"
                    ON "ChatConversations" ("Type");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_ChatConversations_UserIdLow_UserIdHigh"
                    ON "ChatConversations" ("UserIdLow", "UserIdHigh");

                CREATE TABLE IF NOT EXISTS "ChatMessages" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "ConversationId" bigint NOT NULL,
                    "SenderUserId" character varying(450) NOT NULL,
                    "Text" character varying(4000) NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "EditedAt" timestamp with time zone NULL,
                    "ReplyToMessageId" bigint NULL,
                    CONSTRAINT "FK_ChatMessages_ChatConversations_ConversationId"
                        FOREIGN KEY ("ConversationId") REFERENCES "ChatConversations" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_ChatMessages_ConversationId_Id"
                    ON "ChatMessages" ("ConversationId", "Id");

                CREATE TABLE IF NOT EXISTS "ChatReadStates" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "UserId" character varying(450) NOT NULL,
                    "ConversationId" bigint NOT NULL,
                    "LastReadMessageId" bigint NOT NULL,
                    "UpdatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "FK_ChatReadStates_ChatConversations_ConversationId"
                        FOREIGN KEY ("ConversationId") REFERENCES "ChatConversations" ("Id") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_ChatReadStates_UserId_ConversationId"
                    ON "ChatReadStates" ("UserId", "ConversationId");

                CREATE TABLE IF NOT EXISTS "ChatAttachments" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "MessageId" bigint NOT NULL,
                    "FileName" character varying(260) NOT NULL,
                    "ContentType" character varying(120) NOT NULL,
                    "SizeBytes" bigint NOT NULL,
                    "StoragePath" character varying(500) NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "FK_ChatAttachments_ChatMessages_MessageId"
                        FOREIGN KEY ("MessageId") REFERENCES "ChatMessages" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_ChatAttachments_MessageId"
                    ON "ChatAttachments" ("MessageId");
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE "ChatMessages"
                    ADD COLUMN IF NOT EXISTS "EditedAt" timestamp with time zone NULL;
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE "ChatMessages"
                    ADD COLUMN IF NOT EXISTS "ReplyToMessageId" bigint NULL;
                """, cancellationToken);

            // Keep __EFMigrationsHistory in sync when only startup patches ran (no apply-migrations yet).
            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260710120000_AddChatTables', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260710120000_AddChatTables'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260710170000_AddChatMessageEditedAt', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260710170000_AddChatMessageEditedAt'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260711120000_AddChatMessageReplyTo', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260711120000_AddChatMessageReplyTo'
                );
                """, cancellationToken);

            logger.LogInformation("Таблицы чата проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (Chat)");
            throw;
        }
    }

    private static async Task ApplyWebPushSubscriptionsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "WebPushSubscriptions" (
                    "Id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "UserId" character varying(450) NOT NULL,
                    "Endpoint" character varying(2048) NOT NULL,
                    "P256dh" character varying(256) NOT NULL,
                    "Auth" character varying(128) NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_WebPushSubscriptions_Endpoint"
                    ON "WebPushSubscriptions" ("Endpoint");
                CREATE INDEX IF NOT EXISTS "IX_WebPushSubscriptions_UserId"
                    ON "WebPushSubscriptions" ("UserId");
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260710141500_AddWebPushSubscriptions', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260710141500_AddWebPushSubscriptions'
                );
                """, cancellationToken);

            logger.LogInformation("Таблица WebPushSubscriptions проверена/создана (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (WebPushSubscriptions)");
            throw;
        }
    }

    private static async Task ApplyPhase2PerformanceIndexesPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE INDEX IF NOT EXISTS "IX_WorkIntervals_OpenInterval"
                    ON "WorkIntervals" ("ProductionTaskId")
                    WHERE "EndTime" IS NULL;

                CREATE INDEX IF NOT EXISTS "IX_WorkIntervals_RangeLookup"
                    ON "WorkIntervals" ("StartTime", "EndTime");

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_EmployeeName_CompletedAt"
                    ON "ProductionTasks" ("EmployeeName", "CompletedAt")
                    WHERE "Status" = 3;

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_RootTableVisible"
                    ON "ProductionTasks" ("DisplayOrder" DESC, "Id" DESC)
                    WHERE "ParentRowNumber" IS NULL AND NOT "HiddenFromTaskTable";

                CREATE INDEX IF NOT EXISTS "IX_Users_FullName"
                    ON "Users" ("FullName");
                """, cancellationToken);
            logger.LogInformation("Индексы производительности (phase 2) проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при создании индексов производительности (PostgreSQL)");
            throw;
        }
    }
}
