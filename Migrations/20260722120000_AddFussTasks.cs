using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// ProductionTasks.IsFuss + nullable Deadline для номинальных задач «Суета».
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260722120000_AddFussTasks")]
    public partial class AddFussTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ProductionTasks"
                    ADD COLUMN IF NOT EXISTS "IsFuss" boolean NOT NULL DEFAULT false;

                ALTER TABLE "ProductionTasks"
                    ALTER COLUMN "Deadline" DROP NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "ProductionTasks"
                SET "Deadline" = TIMESTAMPTZ '2099-01-01 00:00:00+00'
                WHERE "Deadline" IS NULL;

                ALTER TABLE "ProductionTasks"
                    ALTER COLUMN "Deadline" SET NOT NULL;

                ALTER TABLE "ProductionTasks" DROP COLUMN IF EXISTS "IsFuss";
                """);
        }
    }
}
