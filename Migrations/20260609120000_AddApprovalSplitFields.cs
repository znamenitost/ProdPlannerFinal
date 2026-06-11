using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    [Migration("20260609120000_AddApprovalSplitFields")]
    public partial class AddApprovalSplitFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsApprovalTestPart",
                table: "TaskSplits",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ApprovalGateTestChildId",
                table: "TaskSplits",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsApprovalTestPart",
                table: "TaskSplits");

            migrationBuilder.DropColumn(
                name: "ApprovalGateTestChildId",
                table: "TaskSplits");
        }
    }
}
