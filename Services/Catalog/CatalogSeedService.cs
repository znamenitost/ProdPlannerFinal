using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models.Catalog;

namespace ProductionPlanner.Services.Catalog;

public static class CatalogSeedService
{
    public static async Task SeedIfEmptyAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct = default)
    {
        if (await db.CatalogProducts.AnyAsync(ct))
        {
            await RefreshBudapestMockupAsync(db, logger, ct);
            await RefreshFurnituraAsync(db, logger, ct);
            await RefreshProductTabsAsync(db, logger, ct);
            return;
        }

        var now = DateTime.UtcNow;
        var breloki = new CatalogCategory
        {
            Name = "Брелки",
            Slug = "breloki",
            SortOrder = 1
        };
        var furnituraCat = new CatalogCategory
        {
            Name = "Фурнитура",
            Slug = "furnitura",
            SortOrder = 2
        };
        db.CatalogCategories.AddRange(breloki, furnituraCat);
        await db.SaveChangesAsync(ct);

        var budapest = BuildBudapest(breloki.Id, now);
        var furnitura = BuildFurnitura(furnituraCat.Id, now);
        db.CatalogProducts.AddRange(budapest, furnitura);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Каталог: добавлены категории «Брелки», «Фурнитура» и демо-товары.");
    }

    /// <summary>Обновляет зону мокапа «Будапешт» на актуальные ассеты (идемпотентно).</summary>
    public static async Task RefreshBudapestMockupAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken ct = default)
    {
        var product = await db.CatalogProducts
            .Include(p => p.ArtworkZones)
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Slug == "budapest", ct);
        if (product == null)
            return;

        var specs = JsonSerializer.Serialize(new[]
        {
            new { label = "Изделие", value = "45 × 95 мм" },
            new { label = "Зона нанесения", value = "41 × 66 мм" },
            new { label = "Метод нанесения", value = "УФ печать" },
            new { label = "Формат макета", value = "PDF, SVG, CDR" }
        });

        const string budl = "/catalog/budl.svg";
        const string mask = "/catalog/budapest-mask.svg";
        const string template = "/catalog/budapest-template.cdr";

        var zone = product.ArtworkZones.OrderBy(z => z.SortOrder).FirstOrDefault();
        if (zone == null)
        {
            product.ArtworkZones.Add(new CatalogArtworkZone
            {
                Name = "Лицевая сторона",
                BaseImageUrl = budl,
                MaskUrl = mask,
                MethodPreset = "uv",
                SpecsJson = specs,
                TemplateUrl = template,
                SortOrder = 1
            });
        }
        else
        {
            zone.BaseImageUrl = budl;
            zone.MaskUrl = mask;
            zone.TemplateUrl = template;
            zone.SpecsJson = specs;
            zone.MethodPreset = "uv";
        }

        const string hero = "/catalog/budapest-hero.png";
        const string baseSvg = "/catalog/budapest-base.svg";
        foreach (var img in product.Images.Where(i => i.Kind != CatalogImageKind.Artwork))
        {
            img.Url = img.Kind switch
            {
                CatalogImageKind.Photo => hero,
                _ => baseSvg
            };
        }

        // Цвета брелков (квадратики выбора) + SVG-превью во вкладке «Нанесение».
        var green = EnsureVariant(product, "BP-GN", "Зелёный", "#6F9A88", "/catalog/budgreen.svg", 1,
            "BP-NK");
        var red = EnsureVariant(product, "BP-RD", "Красный", "#D9A8A8", "/catalog/budred.svg", 2,
            "BP-BK");
        var blue = EnsureVariant(product, "BP-BL", "Голубой", "#9DBED4", "/catalog/budblue.svg", 3,
            "BP-GD");

        UpsertVariantArtwork(product, green, "/catalog/budgreen.svg", "Зелёный", 1);
        UpsertVariantArtwork(product, red, "/catalog/budred.svg", "Красный", 2);
        UpsertVariantArtwork(product, blue, "/catalog/budblue.svg", "Голубой", 3);

        foreach (var orphan in product.Images
                     .Where(i => i.Kind == CatalogImageKind.Artwork
                                 && i.Variant != green
                                 && i.Variant != red
                                 && i.Variant != blue
                                 && i.VariantId != green.Id
                                 && i.VariantId != red.Id
                                 && i.VariantId != blue.Id)
                     .ToList())
            db.CatalogProductImages.Remove(orphan);

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Каталог: обновлены ассеты мокапа «Будапешт».");
    }

    /// <summary>Категория «Фурнитура» + товар с hero fur.png (идемпотентно).</summary>
    public static async Task RefreshFurnituraAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken ct = default)
    {
        const string hero = "/catalog/fur.png";
        var now = DateTime.UtcNow;

        var category = await db.CatalogCategories
            .FirstOrDefaultAsync(c => c.Slug == "furnitura", ct);
        if (category == null)
        {
            category = new CatalogCategory
            {
                Name = "Фурнитура",
                Slug = "furnitura",
                SortOrder = 2
            };
            db.CatalogCategories.Add(category);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Каталог: добавлена категория «Фурнитура».");
        }
        else
        {
            category.Name = "Фурнитура";
            category.SortOrder = Math.Max(category.SortOrder, 2);
        }

        // «Брелки» остаётся категорией для брелков.
        var breloki = await db.CatalogCategories.FirstOrDefaultAsync(c => c.Slug == "breloki", ct);
        if (breloki != null)
            breloki.Name = "Брелки";

        var product = await db.CatalogProducts
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .Include(p => p.PriceTiers)
            .Include(p => p.ArtworkZones)
            .FirstOrDefaultAsync(p => p.Slug == "furnitura" || p.Slug == "vienna", ct);

        if (product == null)
        {
            product = BuildFurnitura(category.Id, now);
            db.CatalogProducts.Add(product);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Каталог: добавлен товар фурнитуры.");
            return;
        }

        product.CategoryId = category.Id;
        product.Slug = "furnitura";
        product.Name = "Кольца и карабины";
        product.Description = "Кольца, цепочки и карабины для брелков. Подберите цвет под изделие.";
        product.SortOrder = 1;
        product.UpdatedAt = now;

        // Без зоны нанесения — это комплектующие.
        foreach (var zone in product.ArtworkZones.ToList())
            db.CatalogArtworkZones.Remove(zone);

        var photo = product.Images.FirstOrDefault(i => i.Kind == CatalogImageKind.Photo);
        if (photo == null)
        {
            product.Images.Add(new CatalogProductImage
            {
                Kind = CatalogImageKind.Photo,
                Url = hero,
                SortOrder = 1
            });
        }
        else
        {
            photo.Url = hero;
            photo.SortOrder = 1;
        }

        foreach (var extra in product.Images
                     .Where(i => i.Kind != CatalogImageKind.Photo)
                     .ToList())
            db.CatalogProductImages.Remove(extra);

        EnsureVariant(product, "FR-GN", "Зелёный", "#6F9A88", hero, 1, "VN-SL");
        EnsureVariant(product, "FR-BL", "Голубой", "#9DBED4", hero, 2, "VN-GR");
        EnsureVariant(product, "FR-RD", "Красный", "#D9A8A8", hero, 3);
        EnsureVariant(product, "FR-SV", "Серебро", "#C5CCD3", hero, 4);

        if (!product.PriceTiers.Any())
        {
            product.PriceTiers.AddRange([
                Tier(1, 49, 12m, 1),
                Tier(50, 199, 8m, 2),
                Tier(200, null, 5.5m, 3)
            ]);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Каталог: обновлена категория/товар «Фурнитура».");
    }

    /// <summary>Проставляет явные вкладки всем товарам, у которых их ещё нет.</summary>
    public static async Task RefreshProductTabsAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken ct = default)
    {
        var products = await db.CatalogProducts
            .Include(p => p.Tabs)
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .Include(p => p.ArtworkZones)
            .ToListAsync(ct);

        var changed = 0;
        foreach (var product in products)
        {
            if (product.Tabs.Count > 0) continue;

            var sort = 1;
            product.Tabs.Add(new CatalogProductTab
            {
                Type = CatalogTabType.Photo,
                Label = "Фото",
                IsEnabled = true,
                SortOrder = sort++
            });

            var hasColors = product.Variants.Count > 1
                || product.Variants.Any(v => !string.IsNullOrWhiteSpace(v.PreviewImageUrl))
                || product.Images.Any(i => i.Kind == CatalogImageKind.Artwork);
            if (hasColors)
            {
                product.Tabs.Add(new CatalogProductTab
                {
                    Type = CatalogTabType.Colors,
                    Label = "Цвета",
                    IsEnabled = true,
                    SortOrder = sort++
                });
            }

            if (product.ArtworkZones.Count > 0)
            {
                product.Tabs.Add(new CatalogProductTab
                {
                    Type = CatalogTabType.Mockup,
                    Label = "Примерка",
                    IsEnabled = true,
                    SortOrder = sort++
                });
            }

            product.UpdatedAt = DateTime.UtcNow;
            changed++;
        }

        if (changed > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Каталог: проставлены вкладки для {Count} товаров.", changed);
        }
    }

    private static CatalogProductVariant EnsureVariant(
        CatalogProduct product,
        string sku,
        string colorName,
        string hex,
        string preview,
        int sort,
        string? legacySku = null)
    {
        var variant = product.Variants.FirstOrDefault(v => v.Sku == sku)
            ?? (legacySku != null
                ? product.Variants.FirstOrDefault(v => v.Sku == legacySku)
                : null);

        if (variant == null)
        {
            variant = Variant(sku, colorName, hex, preview, sort);
            product.Variants.Add(variant);
            return variant;
        }

        variant.Sku = sku;
        variant.ColorName = colorName;
        variant.ColorHex = hex;
        variant.PreviewImageUrl = preview;
        variant.SortOrder = sort;
        variant.IsAvailable = true;
        return variant;
    }

    private static void UpsertVariantArtwork(
        CatalogProduct product,
        CatalogProductVariant? variant,
        string url,
        string caption,
        int sortOrder)
    {
        if (variant == null) return;

        var existing = product.Images.FirstOrDefault(i =>
            i.Kind == CatalogImageKind.Artwork && i.VariantId == variant.Id);
        if (existing != null)
        {
            existing.Url = url;
            existing.Caption = caption;
            existing.SortOrder = sortOrder;
            return;
        }

        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Artwork,
            Url = url,
            Caption = caption,
            Variant = variant,
            SortOrder = sortOrder
        });
    }

    private static CatalogProduct BuildBudapest(int categoryId, DateTime now)
    {
        var product = new CatalogProduct
        {
            CategoryId = categoryId,
            Slug = "budapest",
            Name = "Брелок «Будапешт»",
            Description = "Классический металлический брелок. Нанесение — УФ печать.",
            TaskType = "Каталог",
            DefaultEstimateHours = 1,
            IsPublished = true,
            SortOrder = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        const string hero = "/catalog/budapest-hero.png";
        const string baseSvg = "/catalog/budapest-base.svg";
        const string budl = "/catalog/budl.svg";
        var green = Variant("BP-GN", "Зелёный", "#6F9A88", "/catalog/budgreen.svg", 1);
        var red = Variant("BP-RD", "Красный", "#D9A8A8", "/catalog/budred.svg", 2);
        var blue = Variant("BP-BL", "Голубой", "#9DBED4", "/catalog/budblue.svg", 3);
        product.Variants.AddRange([green, red, blue]);

        product.Tabs.AddRange([
            new CatalogProductTab { Type = CatalogTabType.Photo, Label = "Фото", IsEnabled = true, SortOrder = 1 },
            new CatalogProductTab { Type = CatalogTabType.Colors, Label = "Цвета", IsEnabled = true, SortOrder = 2 },
            new CatalogProductTab { Type = CatalogTabType.Mockup, Label = "Примерка", IsEnabled = true, SortOrder = 3 }
        ]);

        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Photo,
            Url = hero,
            SortOrder = 1
        });
        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Example,
            Url = baseSvg,
            Caption = "С УФ печатью",
            SortOrder = 1
        });
        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Artwork,
            Url = "/catalog/budgreen.svg",
            Caption = "Зелёный",
            Variant = green,
            SortOrder = 1
        });
        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Artwork,
            Url = "/catalog/budred.svg",
            Caption = "Красный",
            Variant = red,
            SortOrder = 2
        });
        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Artwork,
            Url = "/catalog/budblue.svg",
            Caption = "Голубой",
            Variant = blue,
            SortOrder = 3
        });

        product.PriceTiers.AddRange([
            Tier(1, 49, 45m, 1),
            Tier(50, 199, 28m, 2),
            Tier(200, null, 18.5m, 3)
        ]);

        product.ArtworkZones.Add(new CatalogArtworkZone
        {
            Name = "Лицевая сторона",
            BaseImageUrl = budl,
            MaskUrl = "/catalog/budapest-mask.svg",
            MethodPreset = "uv",
            SpecsJson = JsonSerializer.Serialize(new[]
            {
                new { label = "Изделие", value = "45 × 95 мм" },
                new { label = "Зона нанесения", value = "41 × 66 мм" },
                new { label = "Метод нанесения", value = "УФ печать" },
                new { label = "Формат макета", value = "PDF, SVG, CDR" }
            }),
            TemplateUrl = "/catalog/budapest-template.cdr",
            SortOrder = 1
        });

        return product;
    }

    private static CatalogProduct BuildFurnitura(int categoryId, DateTime now)
    {
        const string hero = "/catalog/fur.png";
        var product = new CatalogProduct
        {
            CategoryId = categoryId,
            Slug = "furnitura",
            Name = "Кольца и карабины",
            Description = "Кольца, цепочки и карабины для брелков. Подберите цвет под изделие.",
            TaskType = "Каталог",
            DefaultEstimateHours = 0.5,
            IsPublished = true,
            SortOrder = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        product.Variants.AddRange([
            Variant("FR-GN", "Зелёный", "#6F9A88", hero, 1),
            Variant("FR-BL", "Голубой", "#9DBED4", hero, 2),
            Variant("FR-RD", "Красный", "#D9A8A8", hero, 3),
            Variant("FR-SV", "Серебро", "#C5CCD3", hero, 4)
        ]);

        product.Tabs.AddRange([
            new CatalogProductTab { Type = CatalogTabType.Photo, Label = "Фото", IsEnabled = true, SortOrder = 1 },
            new CatalogProductTab { Type = CatalogTabType.Colors, Label = "Цвета", IsEnabled = true, SortOrder = 2 }
        ]);

        product.Images.Add(new CatalogProductImage
        {
            Kind = CatalogImageKind.Photo,
            Url = hero,
            SortOrder = 1
        });

        product.PriceTiers.AddRange([
            Tier(1, 49, 12m, 1),
            Tier(50, 199, 8m, 2),
            Tier(200, null, 5.5m, 3)
        ]);

        return product;
    }

    private static CatalogProductVariant Variant(
        string sku, string colorName, string hex, string preview, int sort) =>
        new()
        {
            Sku = sku,
            ColorName = colorName,
            ColorHex = hex,
            PreviewImageUrl = preview,
            IsAvailable = true,
            SortOrder = sort
        };

    private static CatalogPriceTier Tier(int min, int? max, decimal price, int sort) =>
        new()
        {
            MinQty = min,
            MaxQty = max,
            PricePerUnit = price,
            SortOrder = sort
        };
}
