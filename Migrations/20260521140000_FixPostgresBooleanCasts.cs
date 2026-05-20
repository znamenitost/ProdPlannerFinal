using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class FixPostgresBooleanCasts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Same logic as PostgresLegacySchemaRepair (all schemas, case-insensitive columns).
            migrationBuilder.Sql("""
                DO $$
                DECLARE r RECORD;
                BEGIN
                  FOR r IN
                    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
                    FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    JOIN pg_type t ON t.oid = a.atttypid
                    WHERE c.relkind = 'r'
                      AND NOT a.attisdropped
                      AND a.attnum > 0
                      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND n.nspname NOT LIKE 'pg_toast%'
                      AND lower(a.attname) IN (
                        'isactive', 'emailconfirmed', 'phonenumberconfirmed', 'twofactorenabled', 'lockoutenabled',
                        'notified', 'overduenotified', 'issplittask')
                      AND t.typname IN ('int2', 'int4', 'int8')
                  LOOP
                    EXECUTE format(
                      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE boolean USING (CASE WHEN %I IS NULL THEN NULL ELSE (%I::integer <> 0) END)',
                      r.schema_name, r.table_name, r.column_name, r.column_name, r.column_name);
                  END LOOP;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
