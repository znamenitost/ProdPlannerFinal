using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddAppSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Таблица могла быть создана PostgresSchemaMigrator/DatabaseInitializer до применения EF-миграции.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "AppSettings" (
                    "Key" character varying(128) NOT NULL PRIMARY KEY,
                    "Json" text NOT NULL DEFAULT '{}',
                    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "AppSettings";""");
        }
    }
}
