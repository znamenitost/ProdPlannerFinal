using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

/// <summary>
/// Зона нанесения для интерактивного мокапа.
/// Маска/слои — веб-ассеты (из CDR экспортируются в PNG/SVG на этапе подготовки).
/// </summary>
public class CatalogArtworkZone
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;

    [MaxLength(120)]
    public string Name { get; set; } = "Основная";

    [MaxLength(500)]
    public string? BaseImageUrl { get; set; }

    /// <summary>PNG/SVG с альфой — область нанесения.</summary>
    [MaxLength(500)]
    public string? MaskUrl { get; set; }

    [MaxLength(500)]
    public string? MaterialUrl { get; set; }

    [MaxLength(500)]
    public string? SpecularUrl { get; set; }

    /// <summary>Пресет realism: uv | laser | engraving.</summary>
    [MaxLength(40)]
    public string MethodPreset { get; set; } = "uv";

    [MaxLength(2000)]
    public string SpecsJson { get; set; } = "[]";

    [MaxLength(500)]
    public string? TemplateUrl { get; set; }

    public int SortOrder { get; set; }
}
