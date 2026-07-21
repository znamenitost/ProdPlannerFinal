using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// ProductionTasks.IssuedWithoutReady — выдача без статуса «Готово».
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260721190000_AddIssuedWithoutReady")]
    public partial class AddIssuedWithoutReady : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "IssuedWithoutReady" boolean NOT NULL DEFAULT false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ProductionTasks" DROP COLUMN IF EXISTS "IssuedWithoutReady";
                """);
        }
    }
}
