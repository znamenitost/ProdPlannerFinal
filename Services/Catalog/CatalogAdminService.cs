using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Catalog;
using ProductionPlanner.Models.Dtos.Catalog;

namespace ProductionPlanner.Services.Catalog;

public interface ICatalogAdminService
{
    Task<CatalogAdminTreeDto> GetTreeAsync(CancellationToken ct = default);
    Task<CatalogProductDetailDto?> GetProductAsync(int id, CancellationToken ct = default);
    Task<(CatalogCategoryDto? Cat, string? Error)> CreateCategoryAsync(
        CatalogAdminCreateCategoryRequest request, CancellationToken ct = default);
    Task<(CatalogAdminProductNodeDto? Product, string? Error)> CreateProductAsync(
        CatalogAdminCreateProductRequest request, CancellationToken ct = default);
    Task<string?> UpdateProductAsync(int id, CatalogAdminUpdateProductRequest request, CancellationToken ct = default);
    Task<string?> DeleteProductAsync(int id, CancellationToken ct = default);
    Task<(CatalogProductTabDto? Tab, string? Error)> AddTabAsync(
        int productId, CatalogAdminAddTabRequest request, CancellationToken ct = default);
    Task<string?> UpdateTabAsync(int productId, int tabId, CatalogAdminUpdateTabRequest request, CancellationToken ct = default);
    Task<string?> RemoveTabAsync(int productId, int tabId, CancellationToken ct = default);
    Task<string?> SetPhotoAsync(int productId, string url, string? caption, CancellationToken ct = default);
    Task<string?> ReplaceVariantsAsync(
        int productId, IReadOnlyList<CatalogAdminUpsertVariantRequest> variants, CancellationToken ct = default);
    Task<string?> ReplacePriceTiersAsync(
        int productId, IReadOnlyList<CatalogAdminUpsertPriceTierRequest> tiers, CancellationToken ct = default);
    Task<string?> UpsertZoneAsync(int productId, CatalogAdminUpsertZoneRequest request, CancellationToken ct = default);
    Task<(CatalogAdminUploadResponse? Result, string? Error)> UploadAsync(
        IFormFile file, string kind, CancellationToken ct = default);
}

public class CatalogAdminService : ICatalogAdminService
{
    private static readonly HashSet<string> ImageExt = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".webp", ".svg" };
    private static readonly HashSet<string> TemplateExt = new(StringComparer.OrdinalIgnoreCase)
        { ".cdr", ".pdf", ".svg", ".zip" };

    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _env;

    public CatalogAdminService(ApplicationDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public async Task<CatalogAdminTreeDto> GetTreeAsync(CancellationToken ct = default)
    {
        var categories = await _db.CatalogCategories
            .AsNoTracking()
            .Include(c => c.Products)
                .ThenInclude(p => p.Tabs)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(ct);

        var nodes = categories.Select(c => new CatalogAdminCategoryNodeDto(
            c.Id,
            c.Name,
            c.Slug,
            c.SortOrder,
            c.Products
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.Name)
                .Select(p => new CatalogAdminProductNodeDto(
                    p.Id,
                    p.Slug,
                    p.Name,
                    p.IsPublished,
                    p.SortOrder,
                    p.Tabs
                        .Where(t => t.IsEnabled)
                        .OrderBy(t => t.SortOrder)
                        .Select(t => TabTypeKey(t.Type))
                        .ToList()))
                .ToList())).ToList();

        return new CatalogAdminTreeDto(nodes);
    }

    public async Task<CatalogProductDetailDto?> GetProductAsync(int id, CancellationToken ct = default)
    {
        var product = await LoadProductTrackedAsync(id, ct);
        if (product == null) return null;
        return CatalogService.MapDetailPublic(product);
    }

    public async Task<(CatalogCategoryDto? Cat, string? Error)> CreateCategoryAsync(
        CatalogAdminCreateCategoryRequest request, CancellationToken ct = default)
    {
        var name = (request.Name ?? "").Trim();
        if (name.Length < 2) return (null, "Укажите название категории");

        var slug = string.IsNullOrWhiteSpace(request.Slug) ? Slugify(name) : Slugify(request.Slug!);
        if (await _db.CatalogCategories.AnyAsync(c => c.Slug == slug, ct))
            return (null, "Категория с таким slug уже есть");

        var cat = new CatalogCategory
        {
            Name = name,
            Slug = slug,
            SortOrder = request.SortOrder
        };
        _db.CatalogCategories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return (new CatalogCategoryDto(cat.Id, cat.Name, cat.Slug), null);
    }

    public async Task<(CatalogAdminProductNodeDto? Product, string? Error)> CreateProductAsync(
        CatalogAdminCreateProductRequest request, CancellationToken ct = default)
    {
        var name = (request.Name ?? "").Trim();
        if (name.Length < 2) return (null, "Укажите название товара");

        var category = await _db.CatalogCategories.FirstOrDefaultAsync(c => c.Id == request.CategoryId, ct);
        if (category == null) return (null, "Категория не найдена");

        var slug = string.IsNullOrWhiteSpace(request.Slug) ? Slugify(name) : Slugify(request.Slug!);
        if (await _db.CatalogProducts.AnyAsync(p => p.Slug == slug, ct))
            return (null, "Товар с таким slug уже есть");

        var now = DateTime.UtcNow;
        var product = new CatalogProduct
        {
            CategoryId = category.Id,
            Name = name,
            Slug = slug,
            Description = (request.Description ?? "").Trim(),
            IsPublished = request.IsPublished,
            SortOrder = await _db.CatalogProducts.CountAsync(p => p.CategoryId == category.Id, ct) + 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        var initial = (request.InitialTabs ?? new[] { "photo" })
            .Select(ParseTabType)
            .Where(t => t != null)
            .Select(t => t!.Value)
            .Distinct()
            .ToList();
        if (initial.Count == 0) initial.Add(CatalogTabType.Photo);

        var sort = 1;
        foreach (var type in initial.OrderBy(DefaultSort))
        {
            product.Tabs.Add(new CatalogProductTab
            {
                Type = type,
                Label = DefaultLabel(type),
                IsEnabled = true,
                SortOrder = sort++
            });
        }

        // Корзина требует хотя бы один вариант — создаём нейтральный, если нет вкладки цветов.
        if (!initial.Contains(CatalogTabType.Colors))
        {
            product.Variants.Add(new CatalogProductVariant
            {
                Sku = $"{slug.ToUpperInvariant()}-DEF",
                ColorName = "Стандарт",
                ColorHex = "#C5CCD3",
                IsAvailable = true,
                SortOrder = 1
            });
        }

        product.PriceTiers.Add(new CatalogPriceTier
        {
            MinQty = 1,
            MaxQty = null,
            PricePerUnit = 0,
            SortOrder = 1
        });

        _db.CatalogProducts.Add(product);
        await _db.SaveChangesAsync(ct);

        return (new CatalogAdminProductNodeDto(
            product.Id,
            product.Slug,
            product.Name,
            product.IsPublished,
            product.SortOrder,
            product.Tabs.OrderBy(t => t.SortOrder).Select(t => TabTypeKey(t.Type)).ToList()), null);
    }

    public async Task<string?> UpdateProductAsync(
        int id, CatalogAdminUpdateProductRequest request, CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product == null) return "Товар не найден";

        var name = (request.Name ?? "").Trim();
        if (name.Length < 2) return "Укажите название";

        product.Name = name;
        product.Description = (request.Description ?? "").Trim();
        product.IsPublished = request.IsPublished;
        product.SortOrder = request.SortOrder;
        if (request.CategoryId.HasValue)
            product.CategoryId = request.CategoryId;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<string?> DeleteProductAsync(int id, CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product == null) return "Товар не найден";
        _db.CatalogProducts.Remove(product);
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<(CatalogProductTabDto? Tab, string? Error)> AddTabAsync(
        int productId, CatalogAdminAddTabRequest request, CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts
            .Include(p => p.Tabs)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null) return (null, "Товар не найден");

        var type = ParseTabType(request.Type);
        if (type == null) return (null, "Неизвестный тип вкладки");

        if (product.Tabs.Any(t => t.Type == type))
            return (null, "Такая вкладка уже есть");

        var tab = new CatalogProductTab
        {
            ProductId = productId,
            Type = type.Value,
            Label = string.IsNullOrWhiteSpace(request.Label) ? DefaultLabel(type.Value) : request.Label!.Trim(),
            IsEnabled = true,
            SortOrder = request.SortOrder ?? (product.Tabs.Count == 0 ? 1 : product.Tabs.Max(t => t.SortOrder) + 1)
        };
        _db.CatalogProductTabs.Add(tab);

        if (type == CatalogTabType.Mockup &&
            !await _db.CatalogArtworkZones.AnyAsync(z => z.ProductId == productId, ct))
        {
            _db.CatalogArtworkZones.Add(new CatalogArtworkZone
            {
                ProductId = productId,
                Name = "Лицевая сторона",
                MethodPreset = "uv",
                SpecsJson = "[]",
                SortOrder = 1
            });
        }

        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return (new CatalogProductTabDto(tab.Id, TabTypeKey(tab.Type), tab.Label, tab.IsEnabled, tab.SortOrder), null);
    }

    public async Task<string?> UpdateTabAsync(
        int productId, int tabId, CatalogAdminUpdateTabRequest request, CancellationToken ct = default)
    {
        var tab = await _db.CatalogProductTabs
            .FirstOrDefaultAsync(t => t.Id == tabId && t.ProductId == productId, ct);
        if (tab == null) return "Вкладка не найдена";

        if (!string.IsNullOrWhiteSpace(request.Label)) tab.Label = request.Label.Trim();
        if (request.IsEnabled.HasValue) tab.IsEnabled = request.IsEnabled.Value;
        if (request.SortOrder.HasValue) tab.SortOrder = request.SortOrder.Value;

        var product = await _db.CatalogProducts.FirstAsync(p => p.Id == productId, ct);
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<string?> RemoveTabAsync(int productId, int tabId, CancellationToken ct = default)
    {
        var tab = await _db.CatalogProductTabs
            .FirstOrDefaultAsync(t => t.Id == tabId && t.ProductId == productId, ct);
        if (tab == null) return "Вкладка не найдена";

        _db.CatalogProductTabs.Remove(tab);
        var product = await _db.CatalogProducts.FirstAsync(p => p.Id == productId, ct);
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<string?> SetPhotoAsync(
        int productId, string url, string? caption, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(url)) return "Укажите URL фото";
        var product = await _db.CatalogProducts
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null) return "Товар не найден";

        var photo = product.Images.FirstOrDefault(i => i.Kind == CatalogImageKind.Photo);
        if (photo == null)
        {
            product.Images.Add(new CatalogProductImage
            {
                Kind = CatalogImageKind.Photo,
                Url = url.Trim(),
                Caption = caption,
                SortOrder = 1
            });
        }
        else
        {
            photo.Url = url.Trim();
            photo.Caption = caption;
        }

        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<string?> ReplaceVariantsAsync(
        int productId,
        IReadOnlyList<CatalogAdminUpsertVariantRequest> variants,
        CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts
            .Include(p => p.Variants)
            .ThenInclude(v => v.Images)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null) return "Товар не найден";
        if (variants.Count == 0) return "Добавьте хотя бы один цвет";

        foreach (var orphan in product.Variants.ToList())
            _db.CatalogProductVariants.Remove(orphan);
        await _db.SaveChangesAsync(ct);

        var sort = 1;
        foreach (var v in variants)
        {
            var hex = NormalizeHex(v.ColorHex);
            var name = (v.ColorName ?? "").Trim();
            if (name.Length == 0) return "У цвета должно быть имя";

            product.Variants.Add(new CatalogProductVariant
            {
                Sku = string.IsNullOrWhiteSpace(v.Sku) ? $"CLR-{sort}" : v.Sku!.Trim(),
                ColorName = name,
                ColorHex = hex,
                PreviewImageUrl = string.IsNullOrWhiteSpace(v.PreviewImageUrl) ? null : v.PreviewImageUrl.Trim(),
                IsAvailable = v.IsAvailable,
                SortOrder = v.SortOrder > 0 ? v.SortOrder : sort
            });
            sort++;
        }

        // Artwork-картинки по вариантам для вкладки «Цвета».
        foreach (var art in product.Images.Where(i => i.Kind == CatalogImageKind.Artwork).ToList())
            _db.CatalogProductImages.Remove(art);

        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        // После SaveChanges у вариантов есть Id — добавляем artwork.
        var saved = await _db.CatalogProducts
            .Include(p => p.Variants)
            .Include(p => p.Images)
            .FirstAsync(p => p.Id == productId, ct);
        var artSort = 1;
        foreach (var v in saved.Variants.OrderBy(x => x.SortOrder))
        {
            if (string.IsNullOrWhiteSpace(v.PreviewImageUrl)) continue;
            saved.Images.Add(new CatalogProductImage
            {
                Kind = CatalogImageKind.Artwork,
                Url = v.PreviewImageUrl!,
                Caption = v.ColorName,
                VariantId = v.Id,
                SortOrder = artSort++
            });
        }
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<string?> ReplacePriceTiersAsync(
        int productId,
        IReadOnlyList<CatalogAdminUpsertPriceTierRequest> tiers,
        CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts
            .Include(p => p.PriceTiers)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null) return "Товар не найден";
        if (tiers.Count == 0) return "Нужен хотя бы один ценовой тир";

        foreach (var t in product.PriceTiers.ToList())
            _db.CatalogPriceTiers.Remove(t);

        var sort = 1;
        foreach (var t in tiers.OrderBy(x => x.MinQty))
        {
            if (t.MinQty < 1 || t.PricePerUnit < 0) return "Некорректный ценовой тир";
            product.PriceTiers.Add(new CatalogPriceTier
            {
                MinQty = t.MinQty,
                MaxQty = t.MaxQty,
                PricePerUnit = t.PricePerUnit,
                SortOrder = t.SortOrder > 0 ? t.SortOrder : sort++
            });
        }

        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<string?> UpsertZoneAsync(
        int productId, CatalogAdminUpsertZoneRequest request, CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts
            .Include(p => p.ArtworkZones)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null) return "Товар не найден";

        var zone = product.ArtworkZones.OrderBy(z => z.SortOrder).FirstOrDefault();
        if (zone == null)
        {
            zone = new CatalogArtworkZone { ProductId = productId, SortOrder = 1 };
            product.ArtworkZones.Add(zone);
        }

        zone.Name = string.IsNullOrWhiteSpace(request.Name) ? "Лицевая сторона" : request.Name.Trim();
        zone.BaseImageUrl = EmptyToNull(request.BaseImageUrl);
        zone.MaskUrl = EmptyToNull(request.MaskUrl);
        zone.TemplateUrl = EmptyToNull(request.TemplateUrl);
        zone.MethodPreset = string.IsNullOrWhiteSpace(request.MethodPreset) ? "uv" : request.MethodPreset.Trim();
        zone.SpecsJson = string.IsNullOrWhiteSpace(request.SpecsJson) ? "[]" : request.SpecsJson;

        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<(CatalogAdminUploadResponse? Result, string? Error)> UploadAsync(
        IFormFile file, string kind, CancellationToken ct = default)
    {
        if (file == null || file.Length == 0) return (null, "Файл пуст");

        var ext = Path.GetExtension(file.FileName);
        var isTemplate = string.Equals(kind, "template", StringComparison.OrdinalIgnoreCase);
        var allowed = isTemplate ? TemplateExt : ImageExt;
        if (!allowed.Contains(ext))
            return (null, isTemplate
                ? "Шаблон: .cdr, .pdf, .svg или .zip"
                : "Изображение: .jpg, .png, .webp или .svg");

        var maxBytes = isTemplate ? 15 * 1024 * 1024 : 2 * 1024 * 1024;
        if (file.Length > maxBytes)
            return (null, isTemplate
                ? "Шаблон не больше 15 МБ"
                : "Картинка не больше 2 МБ (лучше WebP/JPEG до 400 КБ)");

        var webRoot = _env.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var dir = Path.Combine(webRoot, "catalog", "uploads");
        Directory.CreateDirectory(dir);

        var safeName = $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var path = Path.Combine(dir, safeName);
        await using (var stream = File.Create(path))
            await file.CopyToAsync(stream, ct);

        var url = $"/catalog/uploads/{safeName}";
        var hint = isTemplate
            ? "CDR/PDF шаблон для скачивания клиентом."
            : "Для витрины: квадрат 1200×1200 или 1600×1600, WebP/JPEG, 150–400 КБ.";

        return (new CatalogAdminUploadResponse(url, safeName, file.Length, hint), null);
    }

    private async Task<CatalogProduct?> LoadProductTrackedAsync(int id, CancellationToken ct)
    {
        var product = await _db.CatalogProducts
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants).ThenInclude(v => v.Images)
            .Include(p => p.Images)
            .Include(p => p.PriceTiers)
            .Include(p => p.ArtworkZones)
            .Include(p => p.Tabs)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product == null) return null;

        product.Variants = product.Variants.OrderBy(v => v.SortOrder).ToList();
        product.Images = product.Images.OrderBy(i => i.SortOrder).ToList();
        product.PriceTiers = product.PriceTiers.OrderBy(t => t.SortOrder).ThenBy(t => t.MinQty).ToList();
        product.ArtworkZones = product.ArtworkZones.OrderBy(z => z.SortOrder).ToList();
        product.Tabs = product.Tabs.OrderBy(t => t.SortOrder).ToList();
        return product;
    }

    public static string TabTypeKey(CatalogTabType t) => t switch
    {
        CatalogTabType.Colors => "colors",
        CatalogTabType.Mockup => "mockup",
        _ => "photo"
    };

    private static CatalogTabType? ParseTabType(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return raw.Trim().ToLowerInvariant() switch
        {
            "photo" or "фото" => CatalogTabType.Photo,
            "colors" or "artwork" or "цвета" => CatalogTabType.Colors,
            "mockup" or "примерка" => CatalogTabType.Mockup,
            _ => null
        };
    }

    private static string DefaultLabel(CatalogTabType t) => t switch
    {
        CatalogTabType.Colors => "Цвета",
        CatalogTabType.Mockup => "Примерка",
        _ => "Фото"
    };

    private static int DefaultSort(CatalogTabType t) => t switch
    {
        CatalogTabType.Photo => 1,
        CatalogTabType.Colors => 2,
        CatalogTabType.Mockup => 3,
        _ => 9
    };

    private static string NormalizeHex(string? hex)
    {
        var h = (hex ?? "").Trim();
        if (Regex.IsMatch(h, "^#[0-9A-Fa-f]{6}$")) return h.ToUpperInvariant();
        if (Regex.IsMatch(h, "^[0-9A-Fa-f]{6}$")) return "#" + h.ToUpperInvariant();
        return "#C5CCD3";
    }

    private static string? EmptyToNull(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string Slugify(string input)
    {
        var map = new Dictionary<char, string>
        {
            ['а']="a",['б']="b",['в']="v",['г']="g",['д']="d",['е']="e",['ё']="e",['ж']="zh",
            ['з']="z",['и']="i",['й']="y",['к']="k",['л']="l",['м']="m",['н']="n",['о']="o",
            ['п']="p",['р']="r",['с']="s",['т']="t",['у']="u",['ф']="f",['х']="h",['ц']="ts",
            ['ч']="ch",['ш']="sh",['щ']="sch",['ъ']="",['ы']="y",['ь']="",['э']="e",['ю']="yu",['я']="ya"
        };
        var sb = new StringBuilder();
        foreach (var ch in input.Trim().ToLowerInvariant())
        {
            if (map.TryGetValue(ch, out var tr)) sb.Append(tr);
            else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) sb.Append(ch);
            else if (ch is ' ' or '-' or '_') sb.Append('-');
        }
        var slug = Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
        return string.IsNullOrEmpty(slug) ? $"item-{DateTime.UtcNow.Ticks}" : slug;
    }
}
