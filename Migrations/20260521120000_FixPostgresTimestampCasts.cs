using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class FixPostgresTimestampCasts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ConvertToTimestamptz(migrationBuilder, "WorkIntervals", "StartTime");
            ConvertToTimestamptz(migrationBuilder, "WorkIntervals", "EndTime");
            ConvertToTimestamptz(migrationBuilder, "Users", "LockoutEnd");
            ConvertToTimestamptz(migrationBuilder, "Users", "CreatedAt");
            ConvertToTimestamptz(migrationBuilder, "UserNotifications", "Deadline");
            ConvertToTimestamptz(migrationBuilder, "UserNotifications", "CreatedAt");
            ConvertToTimestamptz(migrationBuilder, "UserNotifications", "AcknowledgedAt");
            ConvertToTimestamptz(migrationBuilder, "ProductionTasks", "UpdatedAt");
            ConvertToTimestamptz(migrationBuilder, "ProductionTasks", "Deadline");
            ConvertToTimestamptz(migrationBuilder, "ProductionTasks", "CreatedAt");
            ConvertToTimestamptz(migrationBuilder, "ProductionTasks", "CompletedAt");
            ConvertToTimestamptz(migrationBuilder, "EmployeeStats", "LastResetDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }

        private static void ConvertToTimestamptz(MigrationBuilder migrationBuilder, string table, string column)
        {
            migrationBuilder.Sql($"""
                DO $EF$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public' AND c.table_name = '{table}' AND c.column_name = '{column}'
                      AND c.udt_name <> 'timestamptz'
                  ) THEN
                    ALTER TABLE "{table}"
                      ALTER COLUMN "{column}" TYPE timestamp with time zone
                      USING (
                        CASE
                          WHEN "{column}" IS NULL THEN NULL
                          ELSE ("{column}"::text::timestamp with time zone)
                        END
                      );
                  END IF;
                END $EF$;
                """);
        }
    }
}
