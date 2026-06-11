using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddTestPhaseAndApprovalSplitFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApprovalGateTestChildId",
                table: "TaskSplits",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsApprovalTestPart",
                table: "TaskSplits",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "ProductionEstimateHours",
                table: "ProductionTasks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresTestBeforeProduction",
                table: "ProductionTasks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "TestEstimateHours",
                table: "ProductionTasks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<DateTime>(
                name: "TestPhaseCompletedAt",
                table: "ProductionTasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkPhase",
                table: "ProductionTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovalGateTestChildId",
                table: "TaskSplits");

            migrationBuilder.DropColumn(
                name: "IsApprovalTestPart",
                table: "TaskSplits");

            migrationBuilder.DropColumn(
                name: "ProductionEstimateHours",
                table: "ProductionTasks");

            migrationBuilder.DropColumn(
                name: "RequiresTestBeforeProduction",
                table: "ProductionTasks");

            migrationBuilder.DropColumn(
                name: "TestEstimateHours",
                table: "ProductionTasks");

            migrationBuilder.DropColumn(
                name: "TestPhaseCompletedAt",
                table: "ProductionTasks");

            migrationBuilder.DropColumn(
                name: "WorkPhase",
                table: "ProductionTasks");
        }
    }
}
