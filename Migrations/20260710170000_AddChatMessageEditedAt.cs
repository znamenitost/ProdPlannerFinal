using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// ChatMessages.EditedAt for Telegram-style message edits. Idempotent.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260710170000_AddChatMessageEditedAt")]
    public partial class AddChatMessageEditedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ChatMessages"
                    ADD COLUMN IF NOT EXISTS "EditedAt" timestamp with time zone NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ChatMessages" DROP COLUMN IF EXISTS "EditedAt";
                """);
        }
    }
}
