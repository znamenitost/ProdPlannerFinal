using ProductionPlanner.Models.Dtos.Catalog;

namespace ProductionPlanner.Services.Catalog;

public interface ICatalogService
{
    Task<IReadOnlyList<CatalogProductListItemDto>> ListProductsAsync(
        string? categorySlug = null,
        CancellationToken cancellationToken = default);

    Task<CatalogProductDetailDto?> GetProductBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default);

    Task<CatalogQuoteResponse?> QuoteAsync(
        CatalogQuoteRequest request,
        CancellationToken cancellationToken = default);
}
