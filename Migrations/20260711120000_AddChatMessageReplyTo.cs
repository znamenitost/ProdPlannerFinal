using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    /// <summary>
    /// ChatMessages.ReplyToMessageId for Telegram-style replies. Idempotent.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260711120000_AddChatMessageReplyTo")]
    public partial class AddChatMessageReplyTo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ChatMessages"
                    ADD COLUMN IF NOT EXISTS "ReplyToMessageId" bigint NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ChatMessages" DROP COLUMN IF EXISTS "ReplyToMessageId";
                """);
        }
    }
}
