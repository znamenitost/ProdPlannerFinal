using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_TaskSplits_ParentRowNumber"
                    ON "TaskSplits" ("ParentRowNumber");
                CREATE INDEX IF NOT EXISTS "IX_ProductionTasks_EmployeeName_Status"
                    ON "ProductionTasks" ("EmployeeName", "Status");
                CREATE INDEX IF NOT EXISTS "IX_WorkIntervals_ProductionTaskId_StartTime"
                    ON "WorkIntervals" ("ProductionTaskId", "StartTime");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_WorkIntervals_ProductionTaskId_StartTime";
                DROP INDEX IF EXISTS "IX_ProductionTasks_EmployeeName_Status";
                DROP INDEX IF EXISTS "IX_TaskSplits_ParentRowNumber";
                """);
        }
    }
}
