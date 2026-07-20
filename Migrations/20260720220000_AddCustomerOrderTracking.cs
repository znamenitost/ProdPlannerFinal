using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// CustomerOrderTrackings + ProductionTasks.PickupCode for customer order pickup links.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260720220000_AddCustomerOrderTracking")]
    public partial class AddCustomerOrderTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "PickupCode" character varying(8) NULL;

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
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "CustomerOrderTrackings";
                ALTER TABLE "ProductionTasks" DROP COLUMN IF EXISTS "PickupCode";
                """);
        }
    }
}
