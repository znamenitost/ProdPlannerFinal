using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos.Catalog;
using ProductionPlanner.Services.Catalog;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/catalog/admin")]
[Authorize(Roles = "Admin")]
public class CatalogAdminController : ControllerBase
{
    private readonly ICatalogAdminService _admin;
    private readonly IBackgroundRemovalService _backgroundRemoval;

    public CatalogAdminController(ICatalogAdminService admin, IBackgroundRemovalService backgroundRemoval)
    {
        _admin = admin;
        _backgroundRemoval = backgroundRemoval;
    }

    /// <summary>
    /// Reports whether the local IS-Net background-removal model is loaded and ready.
    /// </summary>
    [HttpGet("background-removal-health")]
    public async Task<ActionResult<BackgroundRemovalDiagnostics>> BackgroundRemovalHealth(
        CancellationToken ct)
        => Ok(await _backgroundRemoval.DiagnoseAsync(ct));

    [HttpGet("tree")]
    public async Task<ActionResult<CatalogAdminTreeDto>> Tree(CancellationToken ct)
        => Ok(await _admin.GetTreeAsync(ct));

    [HttpGet("products/{id:int}")]
    public async Task<ActionResult<CatalogProductDetailDto>> GetProduct(int id, CancellationToken ct)
    {
        var item = await _admin.GetProductAsync(id, ct);
        if (item == null) return NotFound(new { error = "Товар не найден" });
        return Ok(item);
    }

    [HttpPost("categories")]
    public async Task<ActionResult<CatalogCategoryDto>> CreateCategory(
        [FromBody] CatalogAdminCreateCategoryRequest request, CancellationToken ct)
    {
        var (cat, error) = await _admin.CreateCategoryAsync(request, ct);
        if (error != null) return BadRequest(new { error });
        return Ok(cat);
    }

    [HttpPost("products")]
    public async Task<ActionResult<CatalogAdminProductNodeDto>> CreateProduct(
        [FromBody] CatalogAdminCreateProductRequest request, CancellationToken ct)
    {
        var (product, error) = await _admin.CreateProductAsync(request, ct);
        if (error != null) return BadRequest(new { error });
        return Ok(product);
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(
        int id, [FromBody] CatalogAdminUpdateProductRequest request, CancellationToken ct)
    {
        var error = await _admin.UpdateProductAsync(id, request, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id, CancellationToken ct)
    {
        var error = await _admin.DeleteProductAsync(id, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpPost("products/{id:int}/tabs")]
    public async Task<ActionResult<CatalogProductTabDto>> AddTab(
        int id, [FromBody] CatalogAdminAddTabRequest request, CancellationToken ct)
    {
        var (tab, error) = await _admin.AddTabAsync(id, request, ct);
        if (error != null) return BadRequest(new { error });
        return Ok(tab);
    }

    [HttpPut("products/{productId:int}/tabs/{tabId:int}")]
    public async Task<IActionResult> UpdateTab(
        int productId, int tabId, [FromBody] CatalogAdminUpdateTabRequest request, CancellationToken ct)
    {
        var error = await _admin.UpdateTabAsync(productId, tabId, request, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpDelete("products/{productId:int}/tabs/{tabId:int}")]
    public async Task<IActionResult> RemoveTab(int productId, int tabId, CancellationToken ct)
    {
        var error = await _admin.RemoveTabAsync(productId, tabId, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpPut("products/{id:int}/photo")]
    public async Task<IActionResult> SetPhoto(
        int id, [FromBody] CatalogAdminSetPhotoRequest request, CancellationToken ct)
    {
        var error = await _admin.SetPhotoAsync(id, request.Url, request.Caption, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpPut("products/{id:int}/variants")]
    public async Task<IActionResult> ReplaceVariants(
        int id, [FromBody] List<CatalogAdminUpsertVariantRequest> variants, CancellationToken ct)
    {
        var error = await _admin.ReplaceVariantsAsync(id, variants, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpPut("products/{id:int}/price-tiers")]
    public async Task<IActionResult> ReplaceTiers(
        int id, [FromBody] List<CatalogAdminUpsertPriceTierRequest> tiers, CancellationToken ct)
    {
        var error = await _admin.ReplacePriceTiersAsync(id, tiers, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpPut("products/{id:int}/zone")]
    public async Task<IActionResult> UpsertZone(
        int id, [FromBody] CatalogAdminUpsertZoneRequest request, CancellationToken ct)
    {
        var error = await _admin.UpsertZoneAsync(id, request, ct);
        if (error != null) return BadRequest(new { error });
        return NoContent();
    }

    [HttpPost("upload")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<CatalogAdminUploadResponse>> Upload(
        IFormFile file, [FromQuery] string kind = "image", CancellationToken ct = default)
    {
        var (result, error) = await _admin.UploadAsync(file, kind, ct);
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }
}

public record CatalogAdminSetPhotoRequest(string Url, string? Caption);
