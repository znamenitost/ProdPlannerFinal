using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplyModeAndSequenceOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SequenceOrder",
                table: "TaskSplits",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SupplyMode",
                table: "ProductionTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE "ProductionTasks" AS parent
                SET "SupplyMode" = 2
                WHERE EXISTS (
                    SELECT 1
                    FROM "TaskSplits" AS split
                    WHERE split."ParentRowNumber" = parent."Id"
                );
                """);

            migrationBuilder.Sql("""
                UPDATE "TaskSplits" AS split
                SET "SequenceOrder" = ordered."SequenceOrder"
                FROM (
                    SELECT
                        "Id",
                        ROW_NUMBER() OVER (
                            PARTITION BY "ParentRowNumber"
                            ORDER BY "Id"
                        ) AS "SequenceOrder"
                    FROM "TaskSplits"
                ) AS ordered
                WHERE ordered."Id" = split."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SequenceOrder",
                table: "TaskSplits");

            migrationBuilder.DropColumn(
                name: "SupplyMode",
                table: "ProductionTasks");
        }
    }
}
