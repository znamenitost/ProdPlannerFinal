using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// Baseline task comments (create-time admin note): no push / no +N badge.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260718140000_AddTaskCommentIsBaseline")]
    public partial class AddTaskCommentIsBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TaskComments"
                    ADD COLUMN IF NOT EXISTS "IsBaseline" boolean NOT NULL DEFAULT FALSE;

                UPDATE "TaskComments" AS c
                SET "IsBaseline" = TRUE
                WHERE c."Id" IN (
                    SELECT MIN(c2."Id")
                    FROM "TaskComments" AS c2
                    GROUP BY c2."ProductionTaskId"
                )
                AND COALESCE(c."RecipientUserId", '') = ''
                AND c."ReplyToCommentId" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TaskComments" DROP COLUMN IF EXISTS "IsBaseline";
                """);
        }
    }
}
