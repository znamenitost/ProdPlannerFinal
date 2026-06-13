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

            migrationBuilder.CreateIndex(
                name: "IX_WorkIntervals_StartTime_EndTime",
                table: "WorkIntervals",
                columns: new[] { "StartTime", "EndTime" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_FullName",
                table: "Users",
                column: "FullName");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionTasks_EmployeeName_CompletedAt",
                table: "ProductionTasks",
                columns: new[] { "EmployeeName", "CompletedAt" });

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

            migrationBuilder.DropIndex(
                name: "IX_WorkIntervals_StartTime_EndTime",
                table: "WorkIntervals");

            migrationBuilder.DropIndex(
                name: "IX_Users_FullName",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_ProductionTasks_EmployeeName_CompletedAt",
                table: "ProductionTasks");
        }
    }
}
