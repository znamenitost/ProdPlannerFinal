using ProductionPlanner.Models.Catalog;

namespace ProductionPlanner.Services.Catalog;

public static class CatalogPricing
{
    public static CatalogPriceTier? ResolveTier(IEnumerable<CatalogPriceTier> tiers, int quantity)
    {
        if (quantity < 1)
            return null;

        return tiers
            .OrderBy(t => t.MinQty)
            .LastOrDefault(t =>
                quantity >= t.MinQty
                && (t.MaxQty == null || quantity <= t.MaxQty));
    }

    public static decimal? ResolveUnitPrice(IEnumerable<CatalogPriceTier> tiers, int quantity) =>
        ResolveTier(tiers, quantity)?.PricePerUnit;

    public static CatalogPriceTier? NextCheaperTier(IEnumerable<CatalogPriceTier> tiers, int quantity)
    {
        var ordered = tiers.OrderBy(t => t.MinQty).ToList();
        var active = ResolveTier(ordered, quantity);
        if (active == null)
            return ordered.FirstOrDefault();

        return ordered.FirstOrDefault(t => t.MinQty > active.MinQty);
    }
}
