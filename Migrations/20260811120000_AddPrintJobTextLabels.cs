using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260811120000_AddPrintJobTextLabels")]
    public partial class AddPrintJobTextLabels : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "JobType" integer NOT NULL DEFAULT 0;

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Line1" character varying(200) NOT NULL DEFAULT '';

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Line2" character varying(200) NOT NULL DEFAULT '';

                ALTER TABLE "PrintJobs"
                    ADD COLUMN IF NOT EXISTS "Line3" character varying(200) NOT NULL DEFAULT '';
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PrintJobs" DROP COLUMN IF EXISTS "JobType";
                ALTER TABLE "PrintJobs" DROP COLUMN IF EXISTS "Line1";
                ALTER TABLE "PrintJobs" DROP COLUMN IF EXISTS "Line2";
                ALTER TABLE "PrintJobs" DROP COLUMN IF EXISTS "Line3";
                """);
        }
    }
}
