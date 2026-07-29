namespace ProductionPlanner.Models.Catalog;

public class CatalogPriceTier
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;

    public int MinQty { get; set; }
    public int? MaxQty { get; set; }

    public decimal PricePerUnit { get; set; }

    public int SortOrder { get; set; }
}
