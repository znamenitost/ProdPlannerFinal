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
    private readonly BackgroundRemovalJobStore _backgroundRemovalJobs;
    private readonly ILogoVectorizationService _logoVectorization;

    public PublicCatalogController(
        ICatalogService catalog,
        ICatalogOrderService orders,
        IBackgroundRemovalService backgroundRemoval,
        BackgroundRemovalJobStore backgroundRemovalJobs,
        ILogoVectorizationService logoVectorization)
    {
        _catalog = catalog;
        _orders = orders;
        _backgroundRemoval = backgroundRemoval;
        _backgroundRemovalJobs = backgroundRemovalJobs;
        _logoVectorization = logoVectorization;
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
    /// Starts background removal with the local IS-Net ONNX model as a job.
    /// Returns a job id immediately; poll remove-background/status/{id} for
    /// stage/percent updates until done (ORT gives no intra-run progress, so
    /// percent is stage-based with time interpolation).
    /// </summary>
    [HttpPost("remove-background/start")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public ActionResult RemoveBackgroundStart([FromBody] CatalogRemoveBackgroundRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.ImageDataUrl))
            return BadRequest(new { error = "Нет изображения" });

        if (!TryParseDataUrl(request.ImageDataUrl, out var bytes, out var contentType))
            return BadRequest(new { error = "Некорректный формат изображения" });

        var jobId = _backgroundRemovalJobs.Create();
        var fileName = request.FileName;
        _ = Task.Run(async () =>
        {
            // No request cancellation on purpose: the client polls and may
            // disconnect in between; the job must run to completion.
            var result = await _backgroundRemoval.RemoveBackgroundAsync(
                bytes,
                contentType,
                fileName,
                (pct, stage) => _backgroundRemovalJobs.Report(jobId, pct, stage),
                CancellationToken.None);

            if (result.Success && result.PngBytes is not null)
            {
                _backgroundRemovalJobs.Complete(
                    jobId, $"data:image/png;base64,{Convert.ToBase64String(result.PngBytes)}");
            }
            else
            {
                _backgroundRemovalJobs.Fail(jobId, result.Error ?? "Не удалось удалить фон");
            }
        });

        return Accepted(new { jobId });
    }

    /// <summary>Polls a background-removal job: { percent, stage, done, error, imageDataUrl }.</summary>
    [HttpGet("remove-background/status/{jobId:guid}")]
    public ActionResult RemoveBackgroundStatus(Guid jobId)
    {
        var state = _backgroundRemovalJobs.Get(jobId);
        if (state is null)
            return NotFound(new { error = "Задача не найдена (возможно, сайт перезапускался) — попробуйте ещё раз" });
        return Ok(state);
    }

    /// <summary>Converts the current raster logo to a downloadable SVG using local VTracer.</summary>
    [HttpPost("vectorize-logo")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> VectorizeLogo(
        [FromBody] CatalogRemoveBackgroundRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.ImageDataUrl))
            return BadRequest(new { error = "Нет изображения" });

        if (!TryParseDataUrl(request.ImageDataUrl, out var bytes, out _))
            return BadRequest(new { error = "Некорректный формат изображения" });

        var result = await _logoVectorization.VectorizeAsync(bytes, cancellationToken);
        if (!result.Success || result.SvgBytes is null)
            return StatusCode(
                StatusCodes.Status502BadGateway,
                new { error = result.Error ?? "Не удалось преобразовать логотип в SVG" });

        return File(result.SvgBytes, "image/svg+xml; charset=utf-8", "logo.svg");
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
