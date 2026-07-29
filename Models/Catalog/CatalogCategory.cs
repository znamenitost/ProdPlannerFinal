using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

public class CatalogCategory
{
    public int Id { get; set; }

    [MaxLength(120)]
    public string Name { get; set; } = "";

    [MaxLength(120)]
    public string Slug { get; set; } = "";

    public int SortOrder { get; set; }

    public List<CatalogProduct> Products { get; set; } = new();
}
