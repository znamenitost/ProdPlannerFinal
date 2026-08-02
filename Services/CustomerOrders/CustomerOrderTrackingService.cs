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
    Task<PickupCustomerLookupDto?> FindByPickupCodeAsync(string pickupCode, CancellationToken cancellationToken = default);
    Task MarkPickedUpAsync(int taskId, CancellationToken cancellationToken = default);
    Task<PickupIssueResultDto> MarkAllReadyPickedUpAsync(int taskId, CancellationToken cancellationToken = default);

    /// <summary>Гарантирует номера выдачи для набора корневых задач; возвращает taskId → код.</summary>
    Task<IReadOnlyDictionary<int, string>> EnsurePickupCodesForTasksAsync(
        IReadOnlyCollection<int> taskIds,
        CancellationToken cancellationToken = default);
}

public class CustomerOrderTrackingService : ICustomerOrderTrackingService
{
    private readonly ApplicationDbContext _db;
    private readonly ITaskNotificationService _notifications;

    public CustomerOrderTrackingService(
        ApplicationDbContext db,
        ITaskNotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
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
            // Ленивая переключёвка записей, заведённых по старому правилу «последняя папка»:
            // сохраняем публичный токен, но переводим ключ на новую семантику.
            var legacyKey = CustomerOrderKey.TryGetLegacyKey(task.FolderPath);
            if (!string.IsNullOrEmpty(legacyKey) && legacyKey != customerKey)
            {
                tracking = await _db.CustomerOrderTrackings
                    .FirstOrDefaultAsync(t => t.CustomerKey == legacyKey, cancellationToken);
                if (tracking != null)
                {
                    tracking.CustomerKey = customerKey;
                    tracking.CustomerDisplayName = displayName;
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }
        }

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

    public async Task<PickupCustomerLookupDto?> FindByPickupCodeAsync(
        string pickupCode,
        CancellationToken cancellationToken = default)
    {
        var code = PickupCodes.Normalize(pickupCode);
        if (string.IsNullOrEmpty(code))
            return null;

        // Коды выдаёт только PickupCodes.Allocate — всегда верхний регистр без пробелов,
        // поэтому точное сравнение в SQL эквивалентно прежнему OrdinalIgnoreCase
        // и использует индекс по PickupCode вместо полной выгрузки задач.
        var task = await _db.ProductionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                !t.HiddenFromTaskTable
                && t.ParentRowNumber == null
                && t.PickupCode != null
                && t.PickupCode == code,
                cancellationToken);
        if (task == null)
            return null;

        var displayName = CustomerOrderKey.TryGetDisplayName(task.FolderPath) ?? "";
        var customerKey = CustomerOrderKey.Normalize(displayName);
        if (string.IsNullOrEmpty(customerKey))
            return null;

        await EnsurePickupCodesForCustomerAsync(customerKey, displayName, cancellationToken);

        var orders = await LoadCustomerOrdersAsync(customerKey, displayName, cancellationToken);
        return new PickupCustomerLookupDto
        {
            CustomerName = displayName,
            MatchedPickupCode = code,
            Orders = orders.Select(o => new PickupCustomerOrderItemDto
            {
                TaskId = o.TaskId,
                PickupCode = o.PickupCode,
                Title = o.Title,
                Status = o.Status,
                StatusKind = o.StatusKind,
                CanIssue = true
            }).ToList()
        };
    }

    public async Task MarkPickedUpAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken)
            ?? throw new InvalidOperationException("Задача не найдена");

        if (task.HiddenFromTaskTable || task.ParentRowNumber != null)
            throw new InvalidOperationException("Нельзя выдать эту задачу");

        if (task.PickedUpAt != null)
            throw new InvalidOperationException("Заказ уже выдан");

        var status = await ResolveEffectiveStatusAsync(task, cancellationToken);
        task.PickedUpAt = DateTime.UtcNow;
        task.UpdatedAt = DateTime.UtcNow;
        if (status != JobStatus.Completed)
            task.IssuedWithoutReady = true;

        await _db.SaveChangesAsync(cancellationToken);
        await _notifications.NotifyTaskUpdatedAsync(task);
    }

    public async Task<PickupIssueResultDto> MarkAllReadyPickedUpAsync(
        int taskId,
        CancellationToken cancellationToken = default)
    {
        var anchor = await _db.ProductionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken)
            ?? throw new InvalidOperationException("Задача не найдена");

        var displayName = CustomerOrderKey.TryGetDisplayName(anchor.FolderPath)
            ?? throw new InvalidOperationException("Не удалось определить заказчика");
        var customerKey = CustomerOrderKey.Normalize(displayName);

        var parents = await LoadParentsForCustomerAsync(
            customerKey,
            onlyNotPickedUp: true,
            asNoTracking: false,
            cancellationToken);

        if (parents.Count == 0)
            throw new InvalidOperationException("Нет заказов для выдачи");

        var statusById = await ResolveEffectiveStatusesAsync(parents, cancellationToken);
        var now = DateTime.UtcNow;
        var codes = new List<string>();
        var issuedCount = 0;

        foreach (var task in parents)
        {
            statusById.TryGetValue(task.Id, out var status);
            task.PickedUpAt = now;
            task.UpdatedAt = now;
            if (status != JobStatus.Completed)
                task.IssuedWithoutReady = true;

            issuedCount++;
            var code = (task.PickupCode ?? "").Trim();
            if (!string.IsNullOrEmpty(code))
                codes.Add(code);
        }

        await _db.SaveChangesAsync(cancellationToken);
        foreach (var task in parents)
            await _notifications.NotifyTaskUpdatedAsync(task);

        return new PickupIssueResultDto
        {
            IssuedCount = issuedCount,
            PickupCodes = codes
        };
    }

    public async Task<IReadOnlyDictionary<int, string>> EnsurePickupCodesForTasksAsync(
        IReadOnlyCollection<int> taskIds,
        CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<int, string>();
        if (taskIds.Count == 0)
            return result;

        var tasks = await _db.ProductionTasks
            .Where(t => taskIds.Contains(t.Id) && !t.HiddenFromTaskTable && t.ParentRowNumber == null)
            .ToListAsync(cancellationToken);

        var missing = tasks.Where(t => string.IsNullOrWhiteSpace(t.PickupCode)).ToList();
        if (missing.Count > 0)
        {
            var usedCodes = await LoadUsedPickupCodesAsync(cancellationToken);
            foreach (var task in tasks.Where(t => !string.IsNullOrWhiteSpace(t.PickupCode)))
                usedCodes.Add(task.PickupCode!);

            foreach (var task in missing)
            {
                var displayName = CustomerOrderKey.TryGetDisplayName(task.FolderPath) ?? "";
                var letter = CustomerOrderKey.ResolvePickupLetter(task.FolderPath, displayName);
                task.PickupCode = PickupCodes.Allocate(letter, usedCodes);
                // UpdatedAt не трогаем: назначение номера — служебная операция,
                // она не должна ломать конкурентное редактирование строки.
            }

            await _db.SaveChangesAsync(cancellationToken);
        }

        foreach (var task in tasks)
        {
            if (!string.IsNullOrWhiteSpace(task.PickupCode))
                result[task.Id] = task.PickupCode!;
        }

        return result;
    }

    private async Task<List<CustomerOrderPublicItemDto>> LoadCustomerOrdersAsync(
        string customerKey,
        string customerDisplayName,
        CancellationToken cancellationToken)
    {
        var parents = await LoadParentsForCustomerAsync(
            customerKey,
            onlyNotPickedUp: true,
            asNoTracking: true,
            cancellationToken);

        if (parents.Count == 0)
            return [];

        parents = parents
            .OrderBy(t => t.DisplayOrder)
            .ThenBy(t => t.Id)
            .ToList();

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

        var parentIds = parents.Select(p => p.Id).ToList();
        var baselineTextByTaskId = await LoadBaselineCommentsAsync(parentIds, cancellationToken);

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

            baselineTextByTaskId.TryGetValue(parent.Id, out var baselineComment);
            var primaryComment = !string.IsNullOrWhiteSpace(baselineComment)
                ? baselineComment
                : CustomerOrderKey.ExtractPrimaryComment(parent.Comment);

            var (label, kind) = CustomerOrderPublicStatus.Map(status);
            result.Add(new CustomerOrderPublicItemDto
            {
                TaskId = parent.Id,
                Title = CustomerOrderKey.BuildOrderTitle(
                    parent.FileName,
                    primaryComment,
                    customerDisplayName),
                PickupCode = parent.PickupCode ?? "",
                Status = label,
                StatusKind = kind
            });
        }

        return result;
    }

    /// <summary>
    /// Корневые задачи заказчика без полной выгрузки таблицы: сначала из БД забираются
    /// только различные FolderPath (строки-указатели), точный CustomerOrderKey.Matches
    /// применяется к ним в памяти, затем догружаются полные строки по равенству пути.
    /// Семантика фильтра заказчика та же, что при выборке всех задач.
    /// </summary>
    private async Task<List<ProductionTask>> LoadParentsForCustomerAsync(
        string customerKey,
        bool onlyNotPickedUp,
        bool asNoTracking,
        CancellationToken cancellationToken)
    {
        IQueryable<ProductionTask> baseQuery = _db.ProductionTasks
            .Where(t => !t.HiddenFromTaskTable && t.ParentRowNumber == null);
        if (onlyNotPickedUp)
            baseQuery = baseQuery.Where(t => t.PickedUpAt == null);

        var candidatePaths = await baseQuery
            .Select(t => t.FolderPath)
            .Distinct()
            .ToListAsync(cancellationToken);

        // LegacyMatches — для записей CustomerOrderTracking, заведённых до смены
        // семантики ключа на «папка после буквенного указателя».
        var matchedPaths = candidatePaths
            .Where(p => CustomerOrderKey.Matches(p, customerKey)
                || CustomerOrderKey.LegacyMatches(p, customerKey))
            .ToList();
        if (matchedPaths.Count == 0)
            return [];

        var query = baseQuery.Where(t => matchedPaths.Contains(t.FolderPath));
        if (asNoTracking)
            query = query.AsNoTracking();

        return await query.ToListAsync(cancellationToken);
    }

    private async Task<JobStatus> ResolveEffectiveStatusAsync(
        ProductionTask task,
        CancellationToken cancellationToken)
    {
        var map = await ResolveEffectiveStatusesAsync([task], cancellationToken);
        return map.TryGetValue(task.Id, out var status) ? status : task.Status;
    }

    private async Task<Dictionary<int, JobStatus>> ResolveEffectiveStatusesAsync(
        IReadOnlyList<ProductionTask> parents,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<int, JobStatus>(parents.Count);
        var splitIds = parents.Where(p => p.IsSplitTask).Select(p => p.Id).ToList();
        Dictionary<int, List<ProductionTask>> childrenByParent = new();

        if (splitIds.Count > 0)
        {
            var children = await _db.ProductionTasks
                .AsNoTracking()
                .Where(t => t.ParentRowNumber != null && splitIds.Contains(t.ParentRowNumber.Value))
                .ToListAsync(cancellationToken);

            childrenByParent = children
                .GroupBy(c => c.ParentRowNumber!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
        }

        foreach (var parent in parents)
        {
            if (parent.IsSplitTask
                && childrenByParent.TryGetValue(parent.Id, out var kids)
                && kids.Count > 0)
            {
                result[parent.Id] = SplitTaskStatusAggregator.ResolveParentStatus(kids);
            }
            else
            {
                result[parent.Id] = parent.Status;
            }
        }

        return result;
    }

    private async Task<Dictionary<int, string>> LoadBaselineCommentsAsync(
        IReadOnlyList<int> parentIds,
        CancellationToken cancellationToken)
    {
        if (parentIds.Count == 0)
            return new Dictionary<int, string>();

        var baselineByTaskId = await _db.TaskComments
            .AsNoTracking()
            .Where(c => parentIds.Contains(c.ProductionTaskId) && c.IsBaseline)
            .OrderBy(c => c.Id)
            .Select(c => new { c.ProductionTaskId, c.Text })
            .ToListAsync(cancellationToken);

        return baselineByTaskId
            .GroupBy(c => c.ProductionTaskId)
            .ToDictionary(g => g.Key, g => (g.First().Text ?? "").Trim());
    }

    private async Task EnsurePickupCodesForCustomerAsync(
        string customerKey,
        string customerDisplayName,
        CancellationToken cancellationToken)
    {
        var parents = await LoadParentsForCustomerAsync(
            customerKey,
            onlyNotPickedUp: false,
            asNoTracking: false,
            cancellationToken);

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
            task.PickupCode = PickupCodes.Allocate(letter, usedCodes);
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
