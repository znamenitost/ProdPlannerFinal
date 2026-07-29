using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

public class CatalogProductImage
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;

    public int? VariantId { get; set; }
    public CatalogProductVariant? Variant { get; set; }

    public CatalogImageKind Kind { get; set; } = CatalogImageKind.Photo;

    [MaxLength(500)]
    public string Url { get; set; } = "";

    [MaxLength(200)]
    public string? Caption { get; set; }

    public int SortOrder { get; set; }
}
