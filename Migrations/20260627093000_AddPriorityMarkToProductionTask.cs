using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddPriorityMarkToProductionTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPriorityMarked",
                table: "ProductionTasks",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPriorityMarked",
                table: "ProductionTasks");
        }
    }
}
