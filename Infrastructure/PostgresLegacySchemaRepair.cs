using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Converts INTEGER/TEXT columns from the first SQLite-style PostgreSQL migration.
/// Scans all user schemas (not only public — required on 1gb.ru shared hosting).
/// </summary>
public static class PostgresLegacySchemaRepair
{
    public const string RepairVersion = "2026-05-21-v4-comprehensive";

    private static readonly string[] BooleanColumns =
    [
        "isactive", "emailconfirmed", "phonenumberconfirmed", "twofactorenabled", "lockoutenabled",
        "notified", "overduenotified", "issplittask"
    ];

    private static readonly string[] TimestampColumns =
    [
        "starttime", "endtime", "lockoutend", "createdat", "updatedat", "deadline", "completedat",
        "acknowledgedat", "lastresetdate"
    ];

    private static readonly string[] DoubleColumns =
    [
        "estimatehours", "progress", "actualhours", "totalsavedhours", "todaysavedhours", "allocatedhours"
    ];

    public static async Task RepairAsync(ApplicationDbContext db, ILogger logger)
    {
        if (!db.Database.IsNpgsql())
            return;

        logger.LogInformation("PostgreSQL schema repair {Version} starting", RepairVersion);

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        await using (var ctxCmd = connection.CreateCommand())
        {
            ctxCmd.CommandText = "SELECT current_database(), current_schema(), current_setting('search_path')";
            await using var r = await ctxCmd.ExecuteReaderAsync();
            if (await r.ReadAsync())
                logger.LogInformation(
                    "PG: database={Db}, current_schema={Schema}, search_path={SearchPath}",
                    r.GetString(0), r.GetString(1), r.GetString(2));
        }

        var boolTargets = await LoadColumnsAsync(connection, BooleanColumns, ["int2", "int4", "int8"]);
        foreach (var col in boolTargets)
        {
            var alter = $"""
                ALTER TABLE {Qualify(col)}
                ALTER COLUMN {QuoteIdent(col.Column)}
                TYPE boolean
                USING (CASE WHEN {QuoteIdent(col.Column)} IS NULL THEN NULL ELSE ({QuoteIdent(col.Column)}::integer <> 0) END)
                """;
            await ExecuteAsync(connection, alter);
            logger.LogInformation("Converted to boolean: {Schema}.{Table}.{Column}", col.Schema, col.Table, col.Column);
        }

        var tsTargets = await LoadColumnsAsync(connection, TimestampColumns, ["text", "varchar", "bpchar"]);
        foreach (var col in tsTargets)
        {
            var alter = $"""
                ALTER TABLE {Qualify(col)}
                ALTER COLUMN {QuoteIdent(col.Column)}
                TYPE timestamp with time zone
                USING (CASE WHEN {QuoteIdent(col.Column)} IS NULL THEN NULL ELSE ({QuoteIdent(col.Column)}::text::timestamp with time zone) END)
                """;
            await ExecuteAsync(connection, alter);
            logger.LogInformation("Converted to timestamptz: {Schema}.{Table}.{Column}", col.Schema, col.Table, col.Column);
        }

        var realTargets = await LoadColumnsAsync(connection, DoubleColumns, ["float4"]);
        foreach (var col in realTargets)
        {
            var alter = $"""
                ALTER TABLE {Qualify(col)}
                ALTER COLUMN {QuoteIdent(col.Column)}
                TYPE double precision
                USING ({QuoteIdent(col.Column)}::double precision)
                """;
            await ExecuteAsync(connection, alter);
            logger.LogInformation("Converted to double precision: {Schema}.{Table}.{Column}", col.Schema, col.Table, col.Column);
        }

        var remaining = await LoadColumnsAsync(connection, BooleanColumns, ["int2", "int4", "int8"]);
        if (remaining.Count > 0)
        {
            var list = string.Join(", ", remaining.Select(c => $"{c.Schema}.{c.Table}.{c.Column}({c.TypeName})"));
            throw new InvalidOperationException(
                $"Колонки-флаги остались integer: {list}. В панели 1gb выполните DROP SCHEMA ... CASCADE или удалите БД и создайте заново.");
        }

        logger.LogInformation("PostgreSQL schema repair {Version} completed", RepairVersion);
    }

    private sealed record ColumnRef(string Schema, string Table, string Column, string TypeName);

    private static async Task<List<ColumnRef>> LoadColumnsAsync(
        DbConnection connection,
        string[] columnNamesLower,
        string[] typeNames)
    {
        var cols = string.Join(", ", columnNamesLower.Select(c => $"'{c}'"));
        var types = string.Join(", ", typeNames.Select(t => $"'{t}'"));

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"""
            SELECT n.nspname, c.relname, a.attname, t.typname
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE c.relkind = 'r'
              AND NOT a.attisdropped
              AND a.attnum > 0
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
              AND n.nspname NOT LIKE 'pg_toast%'
              AND lower(a.attname) IN ({cols})
              AND t.typname IN ({types})
            ORDER BY 1, 2, 3
            """;

        var result = new List<ColumnRef>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(new ColumnRef(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3)));
        }

        return result;
    }

    private static string Qualify(ColumnRef col) =>
        $"{QuoteIdent(col.Schema)}.{QuoteIdent(col.Table)}";

    private static string QuoteIdent(string ident) =>
        "\"" + ident.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";

    private static async Task ExecuteAsync(DbConnection connection, string sql)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync();
    }
}
