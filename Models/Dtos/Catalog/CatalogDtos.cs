namespace ProductionPlanner.Models.Dtos.Catalog;

public record CatalogCategoryDto(int Id, string Name, string Slug);

public record CatalogPriceTierDto(int MinQty, int? MaxQty, decimal PricePerUnit);

public record CatalogVariantDto(
    int Id,
    string Sku,
    string ColorName,
    string ColorHex,
    string? PreviewImageUrl,
    bool IsAvailable,
    IReadOnlyList<CatalogImageDto> Images);

public record CatalogImageDto(
    int Id,
    string Kind,
    string Url,
    string? Caption,
    int? VariantId);

public record CatalogArtworkZoneDto(
    int Id,
    string Name,
    string? BaseImageUrl,
    string? MaskUrl,
    string? MaterialUrl,
    string? SpecularUrl,
    string MethodPreset,
    IReadOnlyList<CatalogSpecDto> Specs,
    string? TemplateUrl);

public record CatalogSpecDto(string Label, string Value);

public record CatalogProductListItemDto(
    int Id,
    string Slug,
    string Name,
    string? CategorySlug,
    string? HeroImageUrl,
    decimal FromPrice,
    IReadOnlyList<CatalogVariantSwatchDto> ColorSwatches);

public record CatalogVariantSwatchDto(
    int Id,
    string ColorName,
    string ColorHex,
    string? PreviewImageUrl);

public record CatalogProductTabDto(
    int Id,
    string Type,
    string Label,
    bool IsEnabled,
    int SortOrder);

public record CatalogProductDetailDto(
    int Id,
    string Slug,
    string Name,
    string Description,
    string? CategorySlug,
    string? CategoryName,
    IReadOnlyList<CatalogVariantDto> Variants,
    IReadOnlyList<CatalogImageDto> Images,
    IReadOnlyList<CatalogPriceTierDto> PriceTiers,
    IReadOnlyList<CatalogArtworkZoneDto> ArtworkZones,
    IReadOnlyList<CatalogProductTabDto> Tabs);

public record CatalogQuoteRequest(int ProductId, int Quantity);

public record CatalogQuoteResponse(
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    int ActiveTierMinQty,
    int? ActiveTierMaxQty,
    int? NextTierMinQty,
    decimal? NextTierUnitPrice,
    IReadOnlyList<CatalogPriceTierDto> Tiers);

public record CatalogCheckoutLineRequest(
    int ProductId,
    int VariantId,
    int Quantity,
    string? MockupTransformJson,
    string? LogoFileUrl);

public record CatalogCheckoutRequest(
    string CustomerName,
    string? Phone,
    string? Telegram,
    string? Email,
    string? Comment,
    DateTime? DesiredDeadline,
    IReadOnlyList<CatalogCheckoutLineRequest> Lines);

public record CatalogCheckoutResponse(
    int OrderId,
    string PublicNumber,
    decimal TotalAmount,
    IReadOnlyList<int> TaskIds);
