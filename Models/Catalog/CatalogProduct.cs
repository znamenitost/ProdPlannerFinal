using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

public class CatalogProduct
{
    public int Id { get; set; }

    public int? CategoryId { get; set; }
    public CatalogCategory? Category { get; set; }

    [MaxLength(120)]
    public string Slug { get; set; } = "";

    [MaxLength(200)]
    public string Name { get; set; } = "";

    [MaxLength(2000)]
    public string Description { get; set; } = "";

    /// <summary>Тип задачи в таблице производства.</summary>
    [MaxLength(100)]
    public string TaskType { get; set; } = "Каталог";

    /// <summary>Оценка часов на позицию по умолчанию.</summary>
    public double DefaultEstimateHours { get; set; } = 1;

    public bool IsPublished { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<CatalogProductVariant> Variants { get; set; } = new();
    public List<CatalogProductImage> Images { get; set; } = new();
    public List<CatalogPriceTier> PriceTiers { get; set; } = new();
    public List<CatalogArtworkZone> ArtworkZones { get; set; } = new();
    public List<CatalogProductTab> Tabs { get; set; } = new();
}
