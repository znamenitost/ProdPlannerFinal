using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260720230000_AddPrintJobs")]
    public partial class AddPrintJobs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "PrintJobs" (
                    "Id" serial NOT NULL,
                    "TaskId" integer NOT NULL,
                    "OrderTitle" character varying(500) NOT NULL,
                    "PrimaryComment" character varying(500) NOT NULL DEFAULT '',
                    "PickupCode" character varying(8) NOT NULL,
                    "Status" integer NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NULL,
                    "ErrorMessage" character varying(500) NULL,
                    "AgentName" character varying(100) NULL,
                    CONSTRAINT "PK_PrintJobs" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_PrintJobs_Status_CreatedAt"
                    ON "PrintJobs" ("Status", "CreatedAt");

                CREATE INDEX IF NOT EXISTS "IX_PrintJobs_TaskId"
                    ON "PrintJobs" ("TaskId");
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "PrintJobs";""");
        }
    }
}
