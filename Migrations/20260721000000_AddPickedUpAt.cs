using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// ProductionTasks.PickedUpAt — момент выдачи заказа клиенту.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260721000000_AddPickedUpAt")]
    public partial class AddPickedUpAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PickedUpAt" timestamp with time zone NULL;

                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_PickupCode"
                    ON "ProductionTasks" ("PickupCode");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_ProductionTasks_PickupCode";
                ALTER TABLE "ProductionTasks" DROP COLUMN IF EXISTS "PickedUpAt";
                """);
        }
    }
}
