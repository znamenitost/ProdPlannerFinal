using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddPriorityRankToProductionTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PriorityRank",
                table: "ProductionTasks",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                WITH ranked AS (
                    SELECT "Id",
                           ROW_NUMBER() OVER (
                               PARTITION BY "EmployeeName"
                               ORDER BY "DisplayOrder" DESC, "Id"
                           ) AS rn
                    FROM "ProductionTasks"
                    WHERE "IsPriorityMarked" = TRUE
                      AND "HiddenFromTaskTable" = FALSE
                      AND "Status" <> 3
                      AND "IsFuss" = FALSE
                      AND NOT ("IsSplitTask" = TRUE AND "ParentRowNumber" IS NULL)
                      AND COALESCE("EmployeeName", '') <> ''
                )
                UPDATE "ProductionTasks" AS t
                SET "PriorityRank" = ranked.rn
                FROM ranked
                WHERE t."Id" = ranked."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PriorityRank",
                table: "ProductionTasks");
        }
    }
}
