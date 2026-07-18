using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// TaskComments stack + migrate existing ProductionTask.Comment into first entries.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260718120000_AddTaskComments")]
    public partial class AddTaskComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "TaskComments" (
                    "Id" bigserial NOT NULL,
                    "ProductionTaskId" integer NOT NULL,
                    "AuthorUserId" character varying(450) NOT NULL,
                    "AuthorName" character varying(100) NOT NULL,
                    "AuthorIsAdmin" boolean NOT NULL,
                    "Text" character varying(4000) NOT NULL,
                    "RecipientUserId" character varying(450) NULL,
                    "RecipientName" character varying(100) NULL,
                    "ReplyToCommentId" bigint NULL,
                    "IsBaseline" boolean NOT NULL DEFAULT FALSE,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_TaskComments" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_TaskComments_ProductionTasks_ProductionTaskId"
                        FOREIGN KEY ("ProductionTaskId") REFERENCES "ProductionTasks" ("Id") ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS "IX_TaskComments_ProductionTaskId_Id"
                    ON "TaskComments" ("ProductionTaskId", "Id");
                """);

            migrationBuilder.Sql("""
                INSERT INTO "TaskComments" (
                    "ProductionTaskId",
                    "AuthorUserId",
                    "AuthorName",
                    "AuthorIsAdmin",
                    "Text",
                    "RecipientUserId",
                    "RecipientName",
                    "ReplyToCommentId",
                    "IsBaseline",
                    "CreatedAt"
                )
                SELECT
                    t."Id",
                    COALESCE(
                        (
                            SELECT u."Id"
                            FROM "Users" u
                            WHERE u."Role" = 'Admin' AND u."IsActive" = TRUE
                            ORDER BY u."CreatedAt"
                            LIMIT 1
                        ),
                        ''
                    ),
                    COALESCE(
                        (
                            SELECT u."FullName"
                            FROM "Users" u
                            WHERE u."Role" = 'Admin' AND u."IsActive" = TRUE
                            ORDER BY u."CreatedAt"
                            LIMIT 1
                        ),
                        'Админ'
                    ),
                    TRUE,
                    TRIM(t."Comment"),
                    NULL,
                    NULL,
                    NULL,
                    TRUE,
                    COALESCE(t."CreatedAt", NOW())
                FROM "ProductionTasks" t
                WHERE TRIM(COALESCE(t."Comment", '')) <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM "TaskComments" c WHERE c."ProductionTaskId" = t."Id"
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "TaskComments";""");
        }
    }
}
