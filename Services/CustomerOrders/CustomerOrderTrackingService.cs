using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Services.CustomerOrders;

public interface ICustomerOrderTrackingService
{
    Task<CustomerOrderLinkDto> CreateOrGetLinkAsync(int taskId, string publicBaseUrl, CancellationToken cancellationToken = default);
    Task<CustomerOrderPublicDto?> GetPublicPageAsync(string token, CancellationToken cancellationToken = default);
}

public class CustomerOrderTrackingService : ICustomerOrderTrackingService
{
    private readonly ApplicationDbContext _db;

    public CustomerOrderTrackingService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<CustomerOrderLinkDto> CreateOrGetLinkAsync(
        int taskId,
        string publicBaseUrl,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.ProductionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken)
            ?? throw new InvalidOperationException("Задача не найдена");

        var displayName = CustomerOrderKey.TryGetDisplayName(task.FolderPath)
            ?? throw new InvalidOperationException(
                "Не удалось определить заказчика: укажите путь к папке клиента (например А/Арета)");

        var customerKey = CustomerOrderKey.Normalize(displayName);
        var tracking = await _db.CustomerOrderTrackings
            .FirstOrDefaultAsync(t => t.CustomerKey == customerKey, cancellationToken);

        if (tracking == null)
        {
            tracking = new CustomerOrderTracking
            {
                CustomerKey = customerKey,
                CustomerDisplayName = displayName,
                PublicToken = GenerateToken(),
                CreatedAt = DateTime.UtcNow
            };
            _db.CustomerOrderTrackings.Add(tracking);
            await _db.SaveChangesAsync(cancellationToken);
        }

        await EnsurePickupCodesForCustomerAsync(customerKey, tracking.CustomerDisplayName, cancellationToken);

        var path = $"/t/{tracking.PublicToken}";
        var baseUrl = (publicBaseUrl ?? "").TrimEnd('/');
        return new CustomerOrderLinkDto
        {
            Token = tracking.PublicToken,
            Path = path,
            Url = string.IsNullOrEmpty(baseUrl) ? path : $"{baseUrl}{path}",
            CustomerName = tracking.CustomerDisplayName
        };
    }

    public async Task<CustomerOrderPublicDto?> GetPublicPageAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var normalizedToken = (token ?? "").Trim();
        if (string.IsNullOrEmpty(normalizedToken))
            return null;

        var tracking = await _db.CustomerOrderTrackings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.PublicToken == normalizedToken, cancellationToken);

        if (tracking == null)
            return null;

        await EnsurePickupCodesForCustomerAsync(
            tracking.CustomerKey,
            tracking.CustomerDisplayName,
            cancellationToken);

        var orders = await LoadCustomerOrdersAsync(
            tracking.CustomerKey,
            tracking.CustomerDisplayName,
            cancellationToken);

        return new CustomerOrderPublicDto
        {
            CustomerName = tracking.CustomerDisplayName,
            Orders = orders
        };
    }

    private async Task<List<CustomerOrderPublicItemDto>> LoadCustomerOrdersAsync(
        string customerKey,
        string customerDisplayName,
        CancellationToken cancellationToken)
    {
        var parents = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t => !t.HiddenFromTaskTable && t.ParentRowNumber == null)
            .OrderBy(t => t.DisplayOrder)
            .ThenBy(t => t.Id)
            .ToListAsync(cancellationToken);

        parents = parents
            .Where(t => CustomerOrderKey.Matches(t.FolderPath, customerKey))
            .ToList();

        if (parents.Count == 0)
            return [];

        var splitParentIds = parents.Where(p => p.IsSplitTask).Select(p => p.Id).ToList();
        Dictionary<int, List<ProductionTask>> childrenByParent = new();
        if (splitParentIds.Count > 0)
        {
            var children = await _db.ProductionTasks
                .AsNoTracking()
                .Where(t => t.ParentRowNumber != null && splitParentIds.Contains(t.ParentRowNumber.Value))
                .ToListAsync(cancellationToken);

            childrenByParent = children
                .GroupBy(c => c.ParentRowNumber!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
        }

        var result = new List<CustomerOrderPublicItemDto>(parents.Count);
        foreach (var parent in parents)
        {
            var status = parent.Status;
            if (parent.IsSplitTask
                && childrenByParent.TryGetValue(parent.Id, out var kids)
                && kids.Count > 0)
            {
                status = SplitTaskStatusAggregator.ResolveParentStatus(kids);
            }

            var (label, kind) = CustomerOrderPublicStatus.Map(status);
            result.Add(new CustomerOrderPublicItemDto
            {
                Title = CustomerOrderKey.BuildOrderTitle(
                    parent.FileName,
                    parent.Comment,
                    customerDisplayName),
                PickupCode = parent.PickupCode ?? "",
                Status = label,
                StatusKind = kind
            });
        }

        return result;
    }

    private async Task EnsurePickupCodesForCustomerAsync(
        string customerKey,
        string customerDisplayName,
        CancellationToken cancellationToken)
    {
        var parents = await _db.ProductionTasks
            .Where(t => !t.HiddenFromTaskTable && t.ParentRowNumber == null)
            .ToListAsync(cancellationToken);

        parents = parents
            .Where(t => CustomerOrderKey.Matches(t.FolderPath, customerKey))
            .ToList();

        if (parents.Count == 0)
            return;

        var missing = parents.Where(t => string.IsNullOrWhiteSpace(t.PickupCode)).ToList();
        if (missing.Count == 0)
            return;

        var usedCodes = await LoadUsedPickupCodesAsync(cancellationToken);
        foreach (var task in parents.Where(t => !string.IsNullOrWhiteSpace(t.PickupCode)))
            usedCodes.Add(task.PickupCode!);

        var changed = false;
        foreach (var task in missing)
        {
            var letter = CustomerOrderKey.ResolvePickupLetter(task.FolderPath, customerDisplayName);
            task.PickupCode = AllocatePickupCode(letter, usedCodes);
            usedCodes.Add(task.PickupCode);
            changed = true;
        }

        if (changed)
            await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<HashSet<string>> LoadUsedPickupCodesAsync(CancellationToken cancellationToken)
    {
        var codes = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t => !t.HiddenFromTaskTable && t.PickupCode != null && t.PickupCode != "")
            .Select(t => t.PickupCode!)
            .ToListAsync(cancellationToken);

        return new HashSet<string>(codes, StringComparer.OrdinalIgnoreCase);
    }

    private static string AllocatePickupCode(char letter, HashSet<string> used)
    {
        for (var attempt = 0; attempt < 200; attempt++)
        {
            var digits = RandomNumberGenerator.GetInt32(0, 100);
            var code = $"{letter}{digits:D2}";
            if (used.Add(code))
                return code;
        }

        // Fallback if 00–99 exhausted for this letter among active tasks
        for (var digits = 0; digits < 100; digits++)
        {
            var code = $"{letter}{digits:D2}";
            if (!used.Contains(code))
            {
                used.Add(code);
                return code;
            }
        }

        return $"{letter}{RandomNumberGenerator.GetInt32(0, 100):D2}";
    }

    private static string GenerateToken()
    {
        Span<byte> bytes = stackalloc byte[16];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
