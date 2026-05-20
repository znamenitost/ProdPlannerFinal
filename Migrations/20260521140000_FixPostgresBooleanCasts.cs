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
            ConvertToBoolean(migrationBuilder, "Users", "IsActive");
            ConvertToBoolean(migrationBuilder, "Users", "EmailConfirmed");
            ConvertToBoolean(migrationBuilder, "Users", "PhoneNumberConfirmed");
            ConvertToBoolean(migrationBuilder, "Users", "TwoFactorEnabled");
            ConvertToBoolean(migrationBuilder, "Users", "LockoutEnabled");

            ConvertToBoolean(migrationBuilder, "ProductionTasks", "Notified");
            ConvertToBoolean(migrationBuilder, "ProductionTasks", "OverdueNotified");
            ConvertToBoolean(migrationBuilder, "ProductionTasks", "IsSplitTask");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }

        private static void ConvertToBoolean(MigrationBuilder migrationBuilder, string table, string column)
        {
            migrationBuilder.Sql($"""
                DO $EF$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public' AND c.table_name = '{table}' AND c.column_name = '{column}'
                      AND c.udt_name <> 'bool'
                  ) THEN
                    ALTER TABLE "{table}"
                      ALTER COLUMN "{column}" TYPE boolean
                      USING (
                        CASE
                          WHEN "{column}" IS NULL THEN NULL
                          ELSE ("{column}"::integer <> 0)
                        END
                      );
                  END IF;
                END $EF$;
                """);
        }
    }
}
