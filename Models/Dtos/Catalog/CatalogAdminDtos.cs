namespace ProductionPlanner.Models.Dtos.Catalog;

public record CatalogAdminTreeDto(
    IReadOnlyList<CatalogAdminCategoryNodeDto> Categories);

public record CatalogAdminCategoryNodeDto(
    int Id,
    string Name,
    string Slug,
    int SortOrder,
    IReadOnlyList<CatalogAdminProductNodeDto> Products);

public record CatalogAdminProductNodeDto(
    int Id,
    string Slug,
    string Name,
    bool IsPublished,
    int SortOrder,
    IReadOnlyList<string> TabTypes);

public record CatalogAdminCreateCategoryRequest(
    string Name,
    string? Slug,
    int SortOrder = 0);

public record CatalogAdminCreateProductRequest(
    int CategoryId,
    string Name,
    string? Slug,
    string? Description,
    bool IsPublished = true,
    /// <summary>Стартовые вкладки: photo, colors, mockup.</summary>
    IReadOnlyList<string>? InitialTabs = null);

public record CatalogAdminUpdateProductRequest(
    string Name,
    string? Description,
    bool IsPublished,
    int SortOrder,
    int? CategoryId);

public record CatalogAdminAddTabRequest(
    string Type,
    string? Label,
    int? SortOrder);

public record CatalogAdminUpdateTabRequest(
    string? Label,
    bool? IsEnabled,
    int? SortOrder);

public record CatalogAdminUpsertVariantRequest(
    int? Id,
    string ColorName,
    string ColorHex,
    string? Sku,
    string? PreviewImageUrl,
    bool IsAvailable = true,
    int SortOrder = 0);

public record CatalogAdminUpsertPriceTierRequest(
    int MinQty,
    int? MaxQty,
    decimal PricePerUnit,
    int SortOrder = 0);

public record CatalogAdminUpsertZoneRequest(
    string Name,
    string? BaseImageUrl,
    string? MaskUrl,
    string? TemplateUrl,
    string MethodPreset,
    string? SpecsJson);

public record CatalogAdminUploadResponse(
    string Url,
    string FileName,
    long SizeBytes,
    string Hint);
