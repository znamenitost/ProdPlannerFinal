using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProductionPlanner.Data;

#nullable disable

namespace ProductionPlanner.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260725120000_AddCatalog")]
    public partial class AddCatalog : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Schema is applied idempotently by PostgresSchemaMigrator.ApplyCatalogTablesPatchAsync.
            migrationBuilder.Sql("""SELECT 1;""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "CatalogOrderLines";
                DROP TABLE IF EXISTS "CatalogOrders";
                DROP TABLE IF EXISTS "CatalogArtworkZones";
                DROP TABLE IF EXISTS "CatalogPriceTiers";
                DROP TABLE IF EXISTS "CatalogProductImages";
                DROP TABLE IF EXISTS "CatalogProductVariants";
                DROP TABLE IF EXISTS "CatalogProducts";
                DROP TABLE IF EXISTS "CatalogCategories";
                """);
        }
    }
}
