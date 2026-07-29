using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

public class CatalogProductVariant
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;

    [MaxLength(80)]
    public string Sku { get; set; } = "";

    [MaxLength(80)]
    public string ColorName { get; set; } = "";

    /// <summary>HEX для fallback, если нет превью.</summary>
    [MaxLength(16)]
    public string ColorHex { get; set; } = "#CCCCCC";

    /// <summary>Превью цвета (маленькое фото для swatch / hover).</summary>
    [MaxLength(500)]
    public string? PreviewImageUrl { get; set; }

    public bool IsAvailable { get; set; } = true;

    public int SortOrder { get; set; }

    public List<CatalogProductImage> Images { get; set; } = new();
}
