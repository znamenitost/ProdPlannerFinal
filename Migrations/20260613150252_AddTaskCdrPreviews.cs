using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskCdrPreviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TaskCdrPreviews",
                columns: table => new
                {
                    TaskId = table.Column<int>(type: "integer", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    ByteSize = table.Column<int>(type: "integer", nullable: false),
                    SourceKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskCdrPreviews", x => x.TaskId);
                    table.ForeignKey(
                        name: "FK_TaskCdrPreviews_ProductionTasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "ProductionTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Индексы могут уже существовать из PostgresSchemaMigrator.ApplyPhase2PerformanceIndexesPatchAsync
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_WorkIntervals_StartTime_EndTime"
                    ON "WorkIntervals" ("StartTime", "EndTime");
                CREATE INDEX IF NOT EXISTS "IX_Users_FullName"
                    ON "Users" ("FullName");
                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_EmployeeName_CompletedAt"
                    ON "ProductionTasks" ("EmployeeName", "CompletedAt");
                """);

            migrationBuilder.CreateIndex(
                name: "IX_TaskCdrPreviews_UpdatedAt",
                table: "TaskCdrPreviews",
                column: "UpdatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskCdrPreviews");

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_WorkIntervals_StartTime_EndTime";
                DROP INDEX IF EXISTS "IX_Users_FullName";
                DROP INDEX IF EXISTS "IX_ProductionTasks_EmployeeName_CompletedAt";
                """);
        }
    }
}
