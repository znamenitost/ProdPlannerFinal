using System.ComponentModel.DataAnnotations;
using ProductionPlanner.Models;

namespace ProductionPlanner.Models.Catalog;

public class CatalogOrderLine
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public CatalogOrder Order { get; set; } = null!;

    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;

    public int VariantId { get; set; }
    public CatalogProductVariant Variant { get; set; } = null!;

    public int Quantity { get; set; }

    public decimal UnitPrice { get; set; }

    public decimal LineTotal { get; set; }

    [MaxLength(200)]
    public string ProductNameSnapshot { get; set; } = "";

    [MaxLength(80)]
    public string ColorNameSnapshot { get; set; } = "";

    [MaxLength(80)]
    public string SkuSnapshot { get; set; } = "";

    /// <summary>JSON: { zoneId, scale, x, y, rotation, logoAssetId }.</summary>
    [MaxLength(2000)]
    public string? MockupTransformJson { get; set; }

    [MaxLength(500)]
    public string? LogoFileUrl { get; set; }

    public int? ProductionTaskId { get; set; }
    public ProductionTask? ProductionTask { get; set; }
}
