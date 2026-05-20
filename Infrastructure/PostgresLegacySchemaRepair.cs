using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Converts columns left from the first SQLite-style PostgreSQL migration (INTEGER booleans, TEXT dates).
/// Runs after EF Migrate on every startup; safe when types are already correct.
/// </summary>
public static class PostgresLegacySchemaRepair
{
    private static readonly string[] BooleanColumnNames =
    [
        "IsActive", "EmailConfirmed", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled",
        "Notified", "OverdueNotified", "IsSplitTask"
    ];

    private static readonly string[] TimestampColumnNames =
    [
        "StartTime", "EndTime", "LockoutEnd", "CreatedAt", "UpdatedAt", "Deadline", "CompletedAt",
        "AcknowledgedAt", "LastResetDate"
    ];

    public static async Task RepairAsync(ApplicationDbContext db, ILogger logger)
    {
        if (!db.Database.IsNpgsql())
            return;

        var boolList = string.Join(", ", BooleanColumnNames.Select(c => $"'{c}'"));
        var tsList = string.Join(", ", TimestampColumnNames.Select(c => $"'{c}'"));

        await db.Database.ExecuteSqlRawAsync($"""
            DO $$
            DECLARE r RECORD;
            BEGIN
              FOR r IN
                SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_type t ON t.oid = a.atttypid
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND NOT a.attisdropped
                  AND a.attnum > 0
                  AND a.attname IN ({boolList})
                  AND t.typname IN ('int2', 'int4', 'int8')
              LOOP
                EXECUTE format(
                  'ALTER TABLE %I.%I ALTER COLUMN %I TYPE boolean USING (CASE WHEN %I IS NULL THEN NULL ELSE (%I::integer <> 0) END)',
                  r.schema_name, r.table_name, r.column_name, r.column_name, r.column_name);
              END LOOP;

              FOR r IN
                SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_type t ON t.oid = a.atttypid
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND NOT a.attisdropped
                  AND a.attnum > 0
                  AND a.attname IN ({tsList})
                  AND t.typname IN ('text', 'varchar', 'bpchar')
              LOOP
                EXECUTE format(
                  'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamp with time zone USING (CASE WHEN %I IS NULL THEN NULL ELSE (%I::text::timestamp with time zone) END)',
                  r.schema_name, r.table_name, r.column_name, r.column_name, r.column_name);
              END LOOP;
            END $$;
            """);

        logger.LogInformation("PostgreSQL legacy schema repair completed (booleans/timestamps).");
    }
}
