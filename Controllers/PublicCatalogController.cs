using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos.Catalog;
using ProductionPlanner.Services.Catalog;

namespace ProductionPlanner.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/public/catalog")]
public class PublicCatalogController : ControllerBase
{
    private readonly ICatalogService _catalog;
    private readonly ICatalogOrderService _orders;

    public PublicCatalogController(ICatalogService catalog, ICatalogOrderService orders)
    {
        _catalog = catalog;
        _orders = orders;
    }

    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<CatalogProductListItemDto>>> List(
        [FromQuery] string? category,
        CancellationToken cancellationToken)
    {
        var items = await _catalog.ListProductsAsync(category, cancellationToken);
        return Ok(items);
    }

    [HttpGet("products/{slug}")]
    public async Task<ActionResult<CatalogProductDetailDto>> Get(
        string slug,
        CancellationToken cancellationToken)
    {
        var item = await _catalog.GetProductBySlugAsync(slug, cancellationToken);
        if (item == null)
            return NotFound(new { error = "Товар не найден" });
        return Ok(item);
    }

    [HttpPost("quote")]
    public async Task<ActionResult<CatalogQuoteResponse>> Quote(
        [FromBody] CatalogQuoteRequest request,
        CancellationToken cancellationToken)
    {
        var quote = await _catalog.QuoteAsync(request, cancellationToken);
        if (quote == null)
            return BadRequest(new { error = "Не удалось рассчитать цену" });
        return Ok(quote);
    }

    [HttpPost("orders")]
    public async Task<ActionResult<CatalogCheckoutResponse>> Checkout(
        [FromBody] CatalogCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        var (response, error) = await _orders.CheckoutAsync(request, cancellationToken);
        if (error != null)
            return BadRequest(new { error });
        return Ok(response);
    }
}
