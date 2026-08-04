using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260804123000_AddPrintJobCopies")]
    public partial class AddPrintJobCopies : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Copies" integer NOT NULL DEFAULT 1;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PrintJobs" DROP COLUMN IF EXISTS "Copies";
                """);
        }
    }
}
