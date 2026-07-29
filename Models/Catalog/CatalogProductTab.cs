using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

/// <summary>
/// Явная вкладка карточки товара (Фото / Цвета / Примерка).
/// </summary>
public class CatalogProductTab
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;

    public CatalogTabType Type { get; set; }

    [MaxLength(80)]
    public string Label { get; set; } = "";

    public bool IsEnabled { get; set; } = true;

    public int SortOrder { get; set; }
}
