using ProductionPlanner.Models.Dtos.Catalog;

namespace ProductionPlanner.Services.Catalog;

public interface ICatalogOrderService
{
    Task<(CatalogCheckoutResponse? Response, string? Error)> CheckoutAsync(
        CatalogCheckoutRequest request,
        CancellationToken cancellationToken = default);
}
