using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Catalog;
using ProductionPlanner.Models.Dtos.Catalog;

namespace ProductionPlanner.Services.Catalog;

public class CatalogService : ICatalogService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ApplicationDbContext _db;

    public CatalogService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<CatalogProductListItemDto>> ListProductsAsync(
        string? categorySlug = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.CatalogProducts
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.Images)
            .Include(p => p.PriceTiers)
            .Where(p => p.IsPublished);

        if (!string.IsNullOrWhiteSpace(categorySlug))
            query = query.Where(p => p.Category != null && p.Category.Slug == categorySlug);

        var products = await query
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);

        return products.Select(MapListItem).ToList();
    }

    public async Task<CatalogProductDetailDto?> GetProductBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(slug))
            return null;

        var product = await _db.CatalogProducts
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Images)
            .Include(p => p.Images)
            .Include(p => p.PriceTiers)
            .Include(p => p.ArtworkZones)
            .Include(p => p.Tabs)
            .FirstOrDefaultAsync(p => p.IsPublished && p.Slug == slug, cancellationToken);

        if (product == null)
            return null;

        product.Variants = product.Variants.OrderBy(v => v.SortOrder).ToList();
        foreach (var v in product.Variants)
            v.Images = v.Images.OrderBy(i => i.SortOrder).ToList();
        product.Images = product.Images.OrderBy(i => i.SortOrder).ToList();
        product.PriceTiers = product.PriceTiers.OrderBy(t => t.SortOrder).ThenBy(t => t.MinQty).ToList();
        product.ArtworkZones = product.ArtworkZones.OrderBy(z => z.SortOrder).ToList();
        product.Tabs = product.Tabs.OrderBy(t => t.SortOrder).ToList();

        return MapDetail(product);
    }

    public async Task<CatalogQuoteResponse?> QuoteAsync(
        CatalogQuoteRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Quantity < 1)
            return null;

        var tiers = await _db.CatalogPriceTiers
            .AsNoTracking()
            .Where(t => t.ProductId == request.ProductId)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.MinQty)
            .ToListAsync(cancellationToken);

        if (tiers.Count == 0)
            return null;

        var active = CatalogPricing.ResolveTier(tiers, request.Quantity);
        if (active == null)
            return null;

        var next = CatalogPricing.NextCheaperTier(tiers, request.Quantity);
        var tierDtos = tiers
            .Select(t => new CatalogPriceTierDto(t.MinQty, t.MaxQty, t.PricePerUnit))
            .ToList();

        return new CatalogQuoteResponse(
            request.Quantity,
            active.PricePerUnit,
            active.PricePerUnit * request.Quantity,
            active.MinQty,
            active.MaxQty,
            next?.MinQty,
            next?.PricePerUnit,
            tierDtos);
    }

    private static CatalogProductListItemDto MapListItem(CatalogProduct p)
    {
        var fromPrice = p.PriceTiers.Count == 0
            ? 0
            : p.PriceTiers.Min(t => t.PricePerUnit);

        var hero = p.Images
            .Where(i => i.Kind == CatalogImageKind.Photo)
            .OrderBy(i => i.SortOrder)
            .Select(i => i.Url)
            .FirstOrDefault()
            ?? p.Variants.OrderBy(v => v.SortOrder).Select(v => v.PreviewImageUrl).FirstOrDefault();

        var swatches = p.Variants
            .Where(v => v.IsAvailable)
            .OrderBy(v => v.SortOrder)
            .Select(v => new CatalogVariantSwatchDto(v.Id, v.ColorName, v.ColorHex, v.PreviewImageUrl))
            .ToList();

        return new CatalogProductListItemDto(
            p.Id,
            p.Slug,
            p.Name,
            p.Category?.Slug,
            hero,
            fromPrice,
            swatches);
    }

    private static CatalogProductDetailDto MapDetail(CatalogProduct p)
    {
        var variants = p.Variants.Select(v => new CatalogVariantDto(
            v.Id,
            v.Sku,
            v.ColorName,
            v.ColorHex,
            v.PreviewImageUrl,
            v.IsAvailable,
            v.Images.Select(MapImage).ToList())).ToList();

        var images = p.Images.Select(MapImage).ToList();
        var tiers = p.PriceTiers
            .Select(t => new CatalogPriceTierDto(t.MinQty, t.MaxQty, t.PricePerUnit))
            .ToList();
        var zones = p.ArtworkZones.Select(MapZone).ToList();
        var tabs = p.Tabs
            .Where(t => t.IsEnabled)
            .OrderBy(t => t.SortOrder)
            .Select(t => new CatalogProductTabDto(
                t.Id,
                CatalogAdminService.TabTypeKey(t.Type),
                string.IsNullOrWhiteSpace(t.Label) ? DefaultTabLabel(t.Type) : t.Label,
                t.IsEnabled,
                t.SortOrder))
            .ToList();

        // Fallback: если вкладок ещё нет — эвристика как раньше.
        if (tabs.Count == 0)
            tabs = InferTabs(p);

        return new CatalogProductDetailDto(
            p.Id,
            p.Slug,
            p.Name,
            p.Description,
            p.Category?.Slug,
            p.Category?.Name,
            variants,
            images,
            tiers,
            zones,
            tabs);
    }

    /// <summary>Публичный маппер для админки (включая выключенные вкладки).</summary>
    public static CatalogProductDetailDto MapDetailPublic(CatalogProduct p)
    {
        var variants = p.Variants.Select(v => new CatalogVariantDto(
            v.Id,
            v.Sku,
            v.ColorName,
            v.ColorHex,
            v.PreviewImageUrl,
            v.IsAvailable,
            v.Images.Select(MapImage).ToList())).ToList();

        var images = p.Images.Select(MapImage).ToList();
        var tiers = p.PriceTiers
            .Select(t => new CatalogPriceTierDto(t.MinQty, t.MaxQty, t.PricePerUnit))
            .ToList();
        var zones = p.ArtworkZones.Select(MapZone).ToList();
        var tabs = p.Tabs
            .OrderBy(t => t.SortOrder)
            .Select(t => new CatalogProductTabDto(
                t.Id,
                CatalogAdminService.TabTypeKey(t.Type),
                string.IsNullOrWhiteSpace(t.Label) ? DefaultTabLabel(t.Type) : t.Label,
                t.IsEnabled,
                t.SortOrder))
            .ToList();

        return new CatalogProductDetailDto(
            p.Id,
            p.Slug,
            p.Name,
            p.Description,
            p.Category?.Slug,
            p.Category?.Name,
            variants,
            images,
            tiers,
            zones,
            tabs);
    }

    private static string DefaultTabLabel(CatalogTabType t) => t switch
    {
        CatalogTabType.Colors => "Цвета",
        CatalogTabType.Mockup => "Примерка",
        _ => "Фото"
    };

    private static List<CatalogProductTabDto> InferTabs(CatalogProduct p)
    {
        var tabs = new List<CatalogProductTabDto>();
        var sort = 1;
        if (p.Images.Any(i => i.Kind == CatalogImageKind.Photo) || p.Variants.Any())
        {
            tabs.Add(new CatalogProductTabDto(0, "photo", "Фото", true, sort++));
        }
        if (p.Variants.Any(v => !string.IsNullOrWhiteSpace(v.PreviewImageUrl) || v.ColorHex != "#CCCCCC")
            || p.Images.Any(i => i.Kind == CatalogImageKind.Artwork))
        {
            tabs.Add(new CatalogProductTabDto(0, "colors", "Цвета", true, sort++));
        }
        if (p.ArtworkZones.Count > 0)
        {
            tabs.Add(new CatalogProductTabDto(0, "mockup", "Примерка", true, sort++));
        }
        if (tabs.Count == 0)
            tabs.Add(new CatalogProductTabDto(0, "photo", "Фото", true, 1));
        return tabs;
    }

    private static CatalogImageDto MapImage(CatalogProductImage i) =>
        new(i.Id, i.Kind.ToString().ToLowerInvariant(), i.Url, i.Caption, i.VariantId);

    private static CatalogArtworkZoneDto MapZone(CatalogArtworkZone z)
    {
        var specs = Array.Empty<CatalogSpecDto>();
        if (!string.IsNullOrWhiteSpace(z.SpecsJson))
        {
            try
            {
                specs = JsonSerializer.Deserialize<CatalogSpecDto[]>(z.SpecsJson, JsonOptions)
                    ?? Array.Empty<CatalogSpecDto>();
            }
            catch (JsonException)
            {
                specs = Array.Empty<CatalogSpecDto>();
            }
        }

        return new CatalogArtworkZoneDto(
            z.Id,
            z.Name,
            z.BaseImageUrl,
            z.MaskUrl,
            z.MaterialUrl,
            z.SpecularUrl,
            z.MethodPreset,
            specs,
            z.TemplateUrl);
    }
}
