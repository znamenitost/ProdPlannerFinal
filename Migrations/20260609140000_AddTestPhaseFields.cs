using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    [Migration("20260609140000_AddTestPhaseFields")]
    public partial class AddTestPhaseFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

            migrationBuilder.AddColumn<double>(
                name: "ProductionEstimateHours",
                table: "ProductionTasks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "WorkPhase",
                table: "ProductionTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "TestPhaseCompletedAt",
                table: "ProductionTasks",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "RequiresTestBeforeProduction", table: "ProductionTasks");
            migrationBuilder.DropColumn(name: "TestEstimateHours", table: "ProductionTasks");
            migrationBuilder.DropColumn(name: "ProductionEstimateHours", table: "ProductionTasks");
            migrationBuilder.DropColumn(name: "WorkPhase", table: "ProductionTasks");
            migrationBuilder.DropColumn(name: "TestPhaseCompletedAt", table: "ProductionTasks");
        }
    }
}
