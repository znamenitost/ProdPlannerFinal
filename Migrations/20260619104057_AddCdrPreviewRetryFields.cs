using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddCdrPreviewRetryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CdrPreviewRetryAt",
                table: "ProductionTasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CdrPreviewRetryAttempts",
                table: "ProductionTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionTasks_CdrPreviewRetryAt",
                table: "ProductionTasks",
                column: "CdrPreviewRetryAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProductionTasks_CdrPreviewRetryAt",
                table: "ProductionTasks");

            migrationBuilder.DropColumn(
                name: "CdrPreviewRetryAt",
                table: "ProductionTasks");

            migrationBuilder.DropColumn(
                name: "CdrPreviewRetryAttempts",
                table: "ProductionTasks");
        }
    }
}
