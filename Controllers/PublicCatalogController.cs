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
    private readonly IBackgroundRemovalService _backgroundRemoval;

    public PublicCatalogController(
        ICatalogService catalog,
        ICatalogOrderService orders,
        IBackgroundRemovalService backgroundRemoval)
    {
        _catalog = catalog;
        _orders = orders;
        _backgroundRemoval = backgroundRemoval;
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

    /// <summary>
    /// Removes background from a customer logo via Hugging Face Gradio Space (BRIA RMBG).
    /// Accepts a data URL (PNG/JPEG/WebP) and returns a PNG data URL with alpha.
    /// </summary>
    [HttpPost("remove-background")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<CatalogRemoveBackgroundResponse>> RemoveBackground(
        [FromBody] CatalogRemoveBackgroundRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.ImageDataUrl))
            return BadRequest(new { error = "Нет изображения" });

        if (!TryParseDataUrl(request.ImageDataUrl, out var bytes, out var contentType))
            return BadRequest(new { error = "Некорректный формат изображения" });

        var result = await _backgroundRemoval.RemoveBackgroundAsync(
            bytes,
            contentType,
            request.FileName,
            cancellationToken);

        if (!result.Success || result.PngBytes is null)
            return StatusCode(StatusCodes.Status502BadGateway, new { error = result.Error ?? "Не удалось удалить фон" });

        var dataUrl = $"data:image/png;base64,{Convert.ToBase64String(result.PngBytes)}";
        return Ok(new CatalogRemoveBackgroundResponse(dataUrl));
    }

    private static bool TryParseDataUrl(string dataUrl, out byte[] bytes, out string contentType)
    {
        bytes = Array.Empty<byte>();
        contentType = "image/png";

        const string prefix = "data:";
        if (!dataUrl.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            return false;

        var comma = dataUrl.IndexOf(',');
        if (comma <= prefix.Length)
            return false;

        var header = dataUrl[prefix.Length..comma];
        var payload = dataUrl[(comma + 1)..];
        if (!header.Contains(";base64", StringComparison.OrdinalIgnoreCase))
            return false;

        var mime = header.Split(';')[0].Trim();
        if (string.IsNullOrWhiteSpace(mime))
            mime = "image/png";
        contentType = mime;

        try
        {
            bytes = Convert.FromBase64String(payload);
            return bytes.Length > 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
