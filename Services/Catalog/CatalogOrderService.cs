using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Catalog;
using ProductionPlanner.Models.Dtos.Catalog;
using ProductionPlanner.Services.CustomerOrders;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Services.Catalog;

public class CatalogOrderService : ICatalogOrderService
{
    private readonly ApplicationDbContext _db;
    private readonly ITaskTableService _taskTable;
    private readonly IAppTimeService _time;

    public CatalogOrderService(
        ApplicationDbContext db,
        ITaskTableService taskTable,
        IAppTimeService time)
    {
        _db = db;
        _taskTable = taskTable;
        _time = time;
    }

    public async Task<(CatalogCheckoutResponse? Response, string? Error)> CheckoutAsync(
        CatalogCheckoutRequest request,
        CancellationToken cancellationToken = default)
    {
        var customerName = request.CustomerName?.Trim() ?? "";
        if (customerName.Length < 2)
            return (null, "Укажите имя или компанию");

        if (string.IsNullOrWhiteSpace(request.Phone) && string.IsNullOrWhiteSpace(request.Telegram))
            return (null, "Укажите телефон или Telegram");

        if (request.Lines == null || request.Lines.Count == 0)
            return (null, "Корзина пуста");

        var productIds = request.Lines.Select(l => l.ProductId).Distinct().ToList();
        var products = await _db.CatalogProducts
            .Include(p => p.Variants)
            .Include(p => p.PriceTiers)
            .Where(p => p.IsPublished && productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        var prepared = new List<(CatalogCheckoutLineRequest Req, CatalogProduct Product, CatalogProductVariant Variant, decimal UnitPrice)>();
        foreach (var line in request.Lines)
        {
            if (line.Quantity < 1)
                return (null, "Количество должно быть не меньше 1");

            if (!products.TryGetValue(line.ProductId, out var product))
                return (null, "Товар не найден или снят с публикации");

            var variant = product.Variants.FirstOrDefault(v => v.Id == line.VariantId && v.IsAvailable);
            if (variant == null)
                return (null, $"Цвет недоступен для «{product.Name}»");

            var unit = CatalogPricing.ResolveUnitPrice(product.PriceTiers, line.Quantity);
            if (unit == null)
                return (null, $"Нет цены для количества {line.Quantity} («{product.Name}»)");

            prepared.Add((line, product, variant, unit.Value));
        }

        var now = _time.Now;
        var deadline = request.DesiredDeadline ?? now.Date.AddDays(7).AddHours(18);
        if (deadline < now)
            deadline = now.Date.AddDays(7).AddHours(18);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var order = new CatalogOrder
            {
                PublicNumber = "",
                Status = CatalogOrderStatus.New,
                CustomerName = customerName,
                Phone = request.Phone?.Trim(),
                Telegram = request.Telegram?.Trim(),
                Email = request.Email?.Trim(),
                Comment = request.Comment?.Trim() ?? "",
                DesiredDeadline = deadline,
                CreatedAt = now,
                TotalAmount = 0
            };

            _db.CatalogOrders.Add(order);
            await _db.SaveChangesAsync(cancellationToken);

            order.PublicNumber = $"C{order.Id:D4}";
            await _db.SaveChangesAsync(cancellationToken);

            var taskIds = new List<int>();
            decimal total = 0;
            var letter = CustomerOrderKey.ResolvePickupLetter(null, customerName);
            var folderPath = $"{CustomerOrderKey.DefaultShareName}/{letter}/{customerName}";

            foreach (var (req, product, variant, unitPrice) in prepared)
            {
                var lineTotal = unitPrice * req.Quantity;
                total += lineTotal;

                var line = new CatalogOrderLine
                {
                    OrderId = order.Id,
                    ProductId = product.Id,
                    VariantId = variant.Id,
                    Quantity = req.Quantity,
                    UnitPrice = unitPrice,
                    LineTotal = lineTotal,
                    ProductNameSnapshot = product.Name,
                    ColorNameSnapshot = variant.ColorName,
                    SkuSnapshot = variant.Sku,
                    MockupTransformJson = req.MockupTransformJson,
                    LogoFileUrl = req.LogoFileUrl
                };

                var contactBits = new List<string>();
                if (!string.IsNullOrWhiteSpace(order.Phone))
                    contactBits.Add($"тел. {order.Phone}");
                if (!string.IsNullOrWhiteSpace(order.Telegram))
                    contactBits.Add($"tg {order.Telegram}");
                if (!string.IsNullOrWhiteSpace(order.Email))
                    contactBits.Add(order.Email!);

                var commentParts = new List<string>
                {
                    $"Заказ {order.PublicNumber}",
                    $"{unitPrice.ToString("0.##", CultureInfo.InvariantCulture)} ₽ × {req.Quantity} = {lineTotal.ToString("0.##", CultureInfo.InvariantCulture)} ₽"
                };
                if (contactBits.Count > 0)
                    commentParts.Add(string.Join(", ", contactBits));
                if (!string.IsNullOrWhiteSpace(order.Comment))
                    commentParts.Add(order.Comment);
                if (!string.IsNullOrWhiteSpace(req.LogoFileUrl))
                    commentParts.Add($"лого: {req.LogoFileUrl}");
                if (!string.IsNullOrWhiteSpace(req.MockupTransformJson))
                    commentParts.Add("мокап: параметры сохранены");

                var createReq = new CreateTaskRequest
                {
                    FolderPath = folderPath,
                    FileName = $"{product.Name} · {variant.ColorName} · {req.Quantity} шт",
                    Comment = string.Join(" · ", commentParts),
                    Deadline = deadline,
                    EstimateHours = product.DefaultEstimateHours > 0 ? product.DefaultEstimateHours : 1,
                    Type = string.IsNullOrWhiteSpace(product.TaskType) ? "Каталог" : product.TaskType,
                    EmployeeName = ""
                };

                var created = await _taskTable.CreateRowAsync(createReq, cancellationToken);
                if (created.Error != null)
                {
                    await tx.RollbackAsync(cancellationToken);
                    return (null, created.Error);
                }

                if (created.Data == null)
                {
                    await tx.RollbackAsync(cancellationToken);
                    return (null, "Не удалось создать задачу в таблице");
                }

                line.ProductionTaskId = created.Data.Id;
                taskIds.Add(created.Data.Id);
                _db.CatalogOrderLines.Add(line);
            }

            order.TotalAmount = total;
            order.Status = CatalogOrderStatus.Confirmed;
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            return (new CatalogCheckoutResponse(order.Id, order.PublicNumber, total, taskIds), null);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(cancellationToken);
            return (null, $"Не удалось оформить заказ: {ex.GetBaseException().Message}");
        }
    }
}
