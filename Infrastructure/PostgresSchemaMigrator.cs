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
        await ApplyTaskCommentsPatchAsync(db, logger, cancellationToken);
        await ApplyCustomerOrderTrackingPatchAsync(db, logger, cancellationToken);
        await ApplyPrintJobsPatchAsync(db, logger, cancellationToken);
        await ApplyWebPushSubscriptionsPatchAsync(db, logger, cancellationToken);
        await ApplyCatalogTablesPatchAsync(db, logger, cancellationToken);
        await ApplyCatalogProductTabsPatchAsync(db, logger, cancellationToken);
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
                    ADD COLUMN IF NOT EXISTS "PriorityRank" integer NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PriorityOrder" integer NOT NULL DEFAULT 0;

                WITH ranked AS (
                    SELECT "Id",
                           ROW_NUMBER() OVER (
                               PARTITION BY "EmployeeName"
                               ORDER BY "DisplayOrder" DESC, "Id"
                           ) AS rn
                    FROM "ProductionTasks"
                    WHERE "IsPriorityMarked" = TRUE
                      AND "PriorityRank" IS NULL
                      AND "HiddenFromTaskTable" = FALSE
                      AND "Status" <> 3
                      AND "IsFuss" = FALSE
                      AND NOT ("IsSplitTask" = TRUE AND "ParentRowNumber" IS NULL)
                      AND COALESCE("EmployeeName", '') <> ''
                )
                UPDATE "ProductionTasks" AS t
                SET "PriorityRank" = ranked.rn
                FROM ranked
                WHERE t."Id" = ranked."Id";

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "CommentEditedViaDialog" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PickupCode" character varying(8) NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PickedUpAt" timestamp with time zone NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "IssuedWithoutReady" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "IsFuss" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ALTER COLUMN "Deadline" DROP NOT NULL;

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_CdrPreviewRetryAt"
                    ON "ProductionTasks" ("CdrPreviewRetryAt");

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_PickupCode"
                    ON "ProductionTasks" ("PickupCode");

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

    private static async Task ApplyTaskCommentsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "TaskComments" (
                    "Id" bigserial NOT NULL,
                    "ProductionTaskId" integer NOT NULL,
                    "AuthorUserId" character varying(450) NOT NULL,
                    "AuthorName" character varying(100) NOT NULL,
                    "AuthorIsAdmin" boolean NOT NULL,
                    "Text" character varying(4000) NOT NULL,
                    "RecipientUserId" character varying(450) NULL,
                    "RecipientName" character varying(100) NULL,
                    "ReplyToCommentId" bigint NULL,
                    "IsBaseline" boolean NOT NULL DEFAULT FALSE,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_TaskComments" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_TaskComments_ProductionTasks_ProductionTaskId"
                        FOREIGN KEY ("ProductionTaskId") REFERENCES "ProductionTasks" ("Id") ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS "IX_TaskComments_ProductionTaskId_Id"
                    ON "TaskComments" ("ProductionTaskId", "Id");

                ALTER TABLE "TaskComments"
                    ADD COLUMN IF NOT EXISTS "IsBaseline" boolean NOT NULL DEFAULT FALSE;
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "TaskComments" (
                    "ProductionTaskId",
                    "AuthorUserId",
                    "AuthorName",
                    "AuthorIsAdmin",
                    "Text",
                    "RecipientUserId",
                    "RecipientName",
                    "ReplyToCommentId",
                    "IsBaseline",
                    "CreatedAt"
                )
                SELECT
                    t."Id",
                    COALESCE(
                        (
                            SELECT u."Id"
                            FROM "Users" u
                            WHERE u."Role" = 'Admin' AND u."IsActive" = TRUE
                            ORDER BY u."CreatedAt"
                            LIMIT 1
                        ),
                        ''
                    ),
                    COALESCE(
                        (
                            SELECT u."FullName"
                            FROM "Users" u
                            WHERE u."Role" = 'Admin' AND u."IsActive" = TRUE
                            ORDER BY u."CreatedAt"
                            LIMIT 1
                        ),
                        'Админ'
                    ),
                    TRUE,
                    TRIM(t."Comment"),
                    NULL,
                    NULL,
                    NULL,
                    TRUE,
                    COALESCE(t."CreatedAt", NOW())
                FROM "ProductionTasks" t
                WHERE TRIM(COALESCE(t."Comment", '')) <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM "TaskComments" c WHERE c."ProductionTaskId" = t."Id"
                  );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                UPDATE "TaskComments" AS c
                SET "IsBaseline" = TRUE
                WHERE c."Id" IN (
                    SELECT MIN(c2."Id")
                    FROM "TaskComments" AS c2
                    GROUP BY c2."ProductionTaskId"
                )
                AND COALESCE(c."RecipientUserId", '') = ''
                AND c."ReplyToCommentId" IS NULL;
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "TaskCommentReadStates" (
                    "Id" bigserial NOT NULL,
                    "UserId" character varying(450) NOT NULL,
                    "ProductionTaskId" integer NOT NULL,
                    "LastReadCommentId" bigint NOT NULL,
                    "UpdatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_TaskCommentReadStates" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TaskCommentReadStates_UserId_ProductionTaskId"
                    ON "TaskCommentReadStates" ("UserId", "ProductionTaskId");
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260718120000_AddTaskComments', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260718120000_AddTaskComments'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260718140000_AddTaskCommentIsBaseline', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260718140000_AddTaskCommentIsBaseline'
                );
                """, cancellationToken);

            logger.LogInformation("Таблицы TaskComments / TaskCommentReadStates проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (TaskComments)");
            throw;
        }
    }

    private static async Task ApplyCustomerOrderTrackingPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PickupCode" character varying(8) NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PickedUpAt" timestamp with time zone NULL;

                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "IssuedWithoutReady" boolean NOT NULL DEFAULT false;

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_PickupCode"
                    ON "ProductionTasks" ("PickupCode");

                CREATE TABLE IF NOT EXISTS "CustomerOrderTrackings" (
                    "Id" serial NOT NULL,
                    "CustomerKey" character varying(200) NOT NULL,
                    "CustomerDisplayName" character varying(200) NOT NULL,
                    "PublicToken" character varying(64) NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CustomerOrderTrackings" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CustomerOrderTrackings_CustomerKey"
                    ON "CustomerOrderTrackings" ("CustomerKey");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CustomerOrderTrackings_PublicToken"
                    ON "CustomerOrderTrackings" ("PublicToken");
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260720220000_AddCustomerOrderTracking', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260720220000_AddCustomerOrderTracking'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260721000000_AddPickedUpAt', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260721000000_AddPickedUpAt'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260721190000_AddIssuedWithoutReady', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260721190000_AddIssuedWithoutReady'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260722120000_AddFussTasks', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260722120000_AddFussTasks'
                );
                """, cancellationToken);

            logger.LogInformation("CustomerOrderTrackings / PickupCode / PickedUpAt / IssuedWithoutReady / IsFuss проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (CustomerOrderTracking)");
            throw;
        }
    }

    private static async Task ApplyPrintJobsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "PrintJobs" (
                    "Id" serial NOT NULL,
                    "TaskId" integer NOT NULL,
                    "OrderTitle" character varying(500) NOT NULL,
                    "PrimaryComment" character varying(500) NOT NULL DEFAULT '',
                    "PickupCode" character varying(8) NOT NULL,
                    "Status" integer NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NULL,
                    "ErrorMessage" character varying(500) NULL,
                    "AgentName" character varying(100) NULL,
                    CONSTRAINT "PK_PrintJobs" PRIMARY KEY ("Id")
                );

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "PrimaryComment" character varying(500) NOT NULL DEFAULT '';

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Copies" integer NOT NULL DEFAULT 1;

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "JobType" integer NOT NULL DEFAULT 0;

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Line1" character varying(200) NOT NULL DEFAULT '';

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Line2" character varying(200) NOT NULL DEFAULT '';

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Line3" character varying(200) NOT NULL DEFAULT '';

                CREATE INDEX IF NOT EXISTS "IX_PrintJobs_Status_CreatedAt"
                    ON "PrintJobs" ("Status", "CreatedAt");

                CREATE INDEX IF NOT EXISTS "IX_PrintJobs_TaskId"
                    ON "PrintJobs" ("TaskId");
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260720230000_AddPrintJobs', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260720230000_AddPrintJobs'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260804123000_AddPrintJobCopies', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260804123000_AddPrintJobCopies'
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260811120000_AddPrintJobTextLabels', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260811120000_AddPrintJobTextLabels'
                );
                """, cancellationToken);

            logger.LogInformation("PrintJobs проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (PrintJobs)");
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

    private static async Task ApplyCatalogTablesPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "CatalogCategories" (
                    "Id" serial NOT NULL,
                    "Name" character varying(120) NOT NULL,
                    "Slug" character varying(120) NOT NULL,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_CatalogCategories" PRIMARY KEY ("Id")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CatalogCategories_Slug"
                    ON "CatalogCategories" ("Slug");

                CREATE TABLE IF NOT EXISTS "CatalogProducts" (
                    "Id" serial NOT NULL,
                    "CategoryId" integer NULL,
                    "Slug" character varying(120) NOT NULL,
                    "Name" character varying(200) NOT NULL,
                    "Description" character varying(2000) NOT NULL DEFAULT '',
                    "TaskType" character varying(100) NOT NULL DEFAULT 'Каталог',
                    "DefaultEstimateHours" double precision NOT NULL DEFAULT 1,
                    "IsPublished" boolean NOT NULL DEFAULT true,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CatalogProducts" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogProducts_CatalogCategories_CategoryId"
                        FOREIGN KEY ("CategoryId") REFERENCES "CatalogCategories" ("Id") ON DELETE SET NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CatalogProducts_Slug"
                    ON "CatalogProducts" ("Slug");

                CREATE TABLE IF NOT EXISTS "CatalogProductVariants" (
                    "Id" serial NOT NULL,
                    "ProductId" integer NOT NULL,
                    "Sku" character varying(80) NOT NULL DEFAULT '',
                    "ColorName" character varying(80) NOT NULL DEFAULT '',
                    "ColorHex" character varying(16) NOT NULL DEFAULT '#CCCCCC',
                    "PreviewImageUrl" character varying(500) NULL,
                    "IsAvailable" boolean NOT NULL DEFAULT true,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_CatalogProductVariants" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogProductVariants_CatalogProducts_ProductId"
                        FOREIGN KEY ("ProductId") REFERENCES "CatalogProducts" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_CatalogProductVariants_ProductId_Sku"
                    ON "CatalogProductVariants" ("ProductId", "Sku");

                CREATE TABLE IF NOT EXISTS "CatalogProductImages" (
                    "Id" serial NOT NULL,
                    "ProductId" integer NOT NULL,
                    "VariantId" integer NULL,
                    "Kind" integer NOT NULL DEFAULT 0,
                    "Url" character varying(500) NOT NULL,
                    "Caption" character varying(200) NULL,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_CatalogProductImages" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogProductImages_CatalogProducts_ProductId"
                        FOREIGN KEY ("ProductId") REFERENCES "CatalogProducts" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_CatalogProductImages_CatalogProductVariants_VariantId"
                        FOREIGN KEY ("VariantId") REFERENCES "CatalogProductVariants" ("Id") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS "CatalogPriceTiers" (
                    "Id" serial NOT NULL,
                    "ProductId" integer NOT NULL,
                    "MinQty" integer NOT NULL,
                    "MaxQty" integer NULL,
                    "PricePerUnit" numeric(12,2) NOT NULL,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_CatalogPriceTiers" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogPriceTiers_CatalogProducts_ProductId"
                        FOREIGN KEY ("ProductId") REFERENCES "CatalogProducts" ("Id") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS "CatalogArtworkZones" (
                    "Id" serial NOT NULL,
                    "ProductId" integer NOT NULL,
                    "Name" character varying(120) NOT NULL DEFAULT 'Основная',
                    "BaseImageUrl" character varying(500) NULL,
                    "MaskUrl" character varying(500) NULL,
                    "MaterialUrl" character varying(500) NULL,
                    "SpecularUrl" character varying(500) NULL,
                    "MethodPreset" character varying(40) NOT NULL DEFAULT 'uv',
                    "SpecsJson" character varying(2000) NOT NULL DEFAULT '[]',
                    "TemplateUrl" character varying(500) NULL,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_CatalogArtworkZones" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogArtworkZones_CatalogProducts_ProductId"
                        FOREIGN KEY ("ProductId") REFERENCES "CatalogProducts" ("Id") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS "CatalogOrders" (
                    "Id" serial NOT NULL,
                    "PublicNumber" character varying(32) NOT NULL DEFAULT '',
                    "Status" integer NOT NULL DEFAULT 0,
                    "CustomerName" character varying(200) NOT NULL,
                    "Phone" character varying(80) NULL,
                    "Telegram" character varying(120) NULL,
                    "Email" character varying(200) NULL,
                    "Comment" character varying(2000) NOT NULL DEFAULT '',
                    "TotalAmount" numeric(14,2) NOT NULL DEFAULT 0,
                    "DesiredDeadline" timestamp with time zone NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CatalogOrders" PRIMARY KEY ("Id")
                );
                CREATE INDEX IF NOT EXISTS "IX_CatalogOrders_PublicNumber"
                    ON "CatalogOrders" ("PublicNumber");

                CREATE TABLE IF NOT EXISTS "CatalogOrderLines" (
                    "Id" serial NOT NULL,
                    "OrderId" integer NOT NULL,
                    "ProductId" integer NOT NULL,
                    "VariantId" integer NOT NULL,
                    "Quantity" integer NOT NULL,
                    "UnitPrice" numeric(12,2) NOT NULL,
                    "LineTotal" numeric(14,2) NOT NULL,
                    "ProductNameSnapshot" character varying(200) NOT NULL DEFAULT '',
                    "ColorNameSnapshot" character varying(80) NOT NULL DEFAULT '',
                    "SkuSnapshot" character varying(80) NOT NULL DEFAULT '',
                    "MockupTransformJson" character varying(2000) NULL,
                    "LogoFileUrl" character varying(500) NULL,
                    "ProductionTaskId" integer NULL,
                    CONSTRAINT "PK_CatalogOrderLines" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogOrderLines_CatalogOrders_OrderId"
                        FOREIGN KEY ("OrderId") REFERENCES "CatalogOrders" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_CatalogOrderLines_CatalogProducts_ProductId"
                        FOREIGN KEY ("ProductId") REFERENCES "CatalogProducts" ("Id") ON DELETE RESTRICT,
                    CONSTRAINT "FK_CatalogOrderLines_CatalogProductVariants_VariantId"
                        FOREIGN KEY ("VariantId") REFERENCES "CatalogProductVariants" ("Id") ON DELETE RESTRICT,
                    CONSTRAINT "FK_CatalogOrderLines_ProductionTasks_ProductionTaskId"
                        FOREIGN KEY ("ProductionTaskId") REFERENCES "ProductionTasks" ("Id") ON DELETE SET NULL
                );
                """, cancellationToken);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20260725120000_AddCatalog', '10.0.7'
                WHERE EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20260725120000_AddCatalog'
                );
                """, cancellationToken);

            logger.LogInformation("Таблицы каталога проверены/созданы (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (Catalog)");
            throw;
        }
    }

    private static async Task ApplyCatalogProductTabsPatchAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "CatalogProductTabs" (
                    "Id" serial NOT NULL,
                    "ProductId" integer NOT NULL,
                    "Type" integer NOT NULL DEFAULT 0,
                    "Label" character varying(80) NOT NULL DEFAULT '',
                    "IsEnabled" boolean NOT NULL DEFAULT true,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_CatalogProductTabs" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_CatalogProductTabs_CatalogProducts_ProductId"
                        FOREIGN KEY ("ProductId") REFERENCES "CatalogProducts" ("Id") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CatalogProductTabs_ProductId_Type"
                    ON "CatalogProductTabs" ("ProductId", "Type");
                """, cancellationToken);
            logger.LogInformation("Таблица CatalogProductTabs проверена/создана (PostgreSQL).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ошибка при обновлении схемы PostgreSQL (CatalogProductTabs)");
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
