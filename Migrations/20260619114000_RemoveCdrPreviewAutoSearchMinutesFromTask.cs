using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCdrPreviewAutoSearchMinutesFromTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CdrPreviewAutoSearchMinutes",
                table: "ProductionTasks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CdrPreviewAutoSearchMinutes",
                table: "ProductionTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
