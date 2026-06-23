using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Services.MaxMessenger;

public interface IMaxMessengerService
{
    Task<MaxLinkStatusDto> GetLinkStatusAsync(string userId, CancellationToken cancellationToken = default);
    Task<MaxLinkTokenDto> CreateLinkTokenAsync(string userId, CancellationToken cancellationToken = default);
    Task UnlinkAsync(string userId, CancellationToken cancellationToken = default);
    Task<int[]> GetSubscribedTaskIdsAsync(string userId, CancellationToken cancellationToken = default);
    Task<bool> IsSubscribedAsync(string userId, int taskId, CancellationToken cancellationToken = default);
    Task SubscribeAsync(string userId, int taskId, CancellationToken cancellationToken = default);
    Task UnsubscribeAsync(string userId, int taskId, CancellationToken cancellationToken = default);
    Task NotifyTaskStatusChangedAsync(ProductionTask task, string newStatus, CancellationToken cancellationToken = default);
    Task HandleUpdateAsync(System.Text.Json.JsonElement update, CancellationToken cancellationToken = default);
}

public sealed class MaxMessengerService : IMaxMessengerService
{
    private const int LinkTokenTtlMinutes = 15;

    private readonly ApplicationDbContext _db;
    private readonly IMaxApiClient _api;
    private readonly MaxBotOptions _options;
    private readonly IAppTimeService _time;
    private readonly ILogger<MaxMessengerService> _logger;

    public MaxMessengerService(
        ApplicationDbContext db,
        IMaxApiClient api,
        IOptions<MaxBotOptions> options,
        IAppTimeService time,
        ILogger<MaxMessengerService> logger)
    {
        _db = db;
        _api = api;
        _options = options.Value;
        _time = time;
        _logger = logger;
    }

    public async Task<MaxLinkStatusDto> GetLinkStatusAsync(string userId, CancellationToken cancellationToken = default)
    {
        var link = await _db.UserMaxLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.UserId == userId && l.IsActive, cancellationToken);

        return new MaxLinkStatusDto
        {
            Linked = link != null,
            BotConfigured = _options.IsConfigured,
            BotUsername = string.IsNullOrWhiteSpace(_options.BotUsername) ? null : _options.BotUsername.Trim(),
            LinkedAt = link?.LinkedAt
        };
    }

    public async Task<MaxLinkTokenDto> CreateLinkTokenAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
            throw new InvalidOperationException("MAX-бот не настроен: укажите MaxBot:AccessToken в конфигурации.");

        var now = _time.Now;
        var code = GenerateLinkCode();
        var expiresAt = now.AddMinutes(LinkTokenTtlMinutes);

        var stale = await _db.MaxLinkTokens
            .Where(t => t.UserId == userId || t.ExpiresAt < now)
            .ToListAsync(cancellationToken);
        if (stale.Count > 0)
            _db.MaxLinkTokens.RemoveRange(stale);

        _db.MaxLinkTokens.Add(new MaxLinkToken
        {
            Code = code,
            UserId = userId,
            ExpiresAt = expiresAt
        });
        await _db.SaveChangesAsync(cancellationToken);

        var botHint = string.IsNullOrWhiteSpace(_options.BotUsername)
            ? "вашего бота в MAX"
            : $"@{_options.BotUsername.Trim().TrimStart('@')}";

        return new MaxLinkTokenDto
        {
            Code = code,
            ExpiresAt = expiresAt,
            Instruction = $"Откройте {botHint} и отправьте:\n/link {code}"
        };
    }

    public async Task UnlinkAsync(string userId, CancellationToken cancellationToken = default)
    {
        var link = await _db.UserMaxLinks.FirstOrDefaultAsync(l => l.UserId == userId, cancellationToken);
        if (link == null)
            return;

        link.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<int[]> GetSubscribedTaskIdsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.TaskMaxSubscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .Select(s => s.TaskId)
            .ToArrayAsync(cancellationToken);
    }

    public async Task<bool> IsSubscribedAsync(string userId, int taskId, CancellationToken cancellationToken = default)
    {
        return await _db.TaskMaxSubscriptions
            .AsNoTracking()
            .AnyAsync(s => s.UserId == userId && s.TaskId == taskId, cancellationToken);
    }

    public async Task SubscribeAsync(string userId, int taskId, CancellationToken cancellationToken = default)
    {
        var taskExists = await _db.ProductionTasks.AsNoTracking().AnyAsync(t => t.Id == taskId, cancellationToken);
        if (!taskExists)
            throw new InvalidOperationException($"Задача #{taskId} не найдена.");

        var linked = await _db.UserMaxLinks.AsNoTracking()
            .AnyAsync(l => l.UserId == userId && l.IsActive, cancellationToken);
        if (!linked)
            throw new InvalidOperationException("Сначала привяжите аккаунт MAX в меню пользователя.");

        var exists = await _db.TaskMaxSubscriptions
            .AnyAsync(s => s.UserId == userId && s.TaskId == taskId, cancellationToken);
        if (exists)
            return;

        _db.TaskMaxSubscriptions.Add(new TaskMaxSubscription
        {
            UserId = userId,
            TaskId = taskId,
            CreatedAt = _time.Now
        });
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task UnsubscribeAsync(string userId, int taskId, CancellationToken cancellationToken = default)
    {
        var row = await _db.TaskMaxSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TaskId == taskId, cancellationToken);
        if (row == null)
            return;

        _db.TaskMaxSubscriptions.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyTaskStatusChangedAsync(
        ProductionTask task,
        string newStatus,
        CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured || task.Id <= 0)
            return;

        // MAX subscription notifications are sent only when the task is completed.
        if (!IsCompletedStatus(newStatus))
            return;

        var statusText = FormatStatusLabel(newStatus);
        if (string.IsNullOrWhiteSpace(statusText))
            return;

        var subscribers = await _db.TaskMaxSubscriptions
            .AsNoTracking()
            .Where(s => s.TaskId == task.Id)
            .Join(
                _db.UserMaxLinks.AsNoTracking().Where(l => l.IsActive),
                s => s.UserId,
                l => l.UserId,
                (_, l) => l.MaxUserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (subscribers.Count == 0)
            return;

        var title = TaskNotificationService.GetNotificationTitle(task);
        var employee = string.IsNullOrWhiteSpace(task.EmployeeName) ? "—" : task.EmployeeName.Trim();
        var deadline = task.Deadline == default
            ? "—"
            : task.Deadline.ToString("d MMMM yyyy", System.Globalization.CultureInfo.GetCultureInfo("ru-RU"));

        var text = $"""
            **Статус задачи изменён**

            **{EscapeMarkdown(title)}**
            Статус: **{EscapeMarkdown(statusText)}**
            Исполнитель: {EscapeMarkdown(employee)}
            Дедлайн: {EscapeMarkdown(deadline)}
            """;

        foreach (var maxUserId in subscribers)
        {
            try
            {
                await _api.SendMessageToUserAsync(maxUserId, text, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Не удалось отправить MAX-уведомление по задаче {TaskId} пользователю {MaxUserId}", task.Id, maxUserId);
            }
        }
    }

    public async Task HandleUpdateAsync(System.Text.Json.JsonElement update, CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
            return;

        if (!update.TryGetProperty("update_type", out var typeEl))
            return;

        var updateType = typeEl.GetString() ?? "";

        if (updateType is "bot_stopped" or "bot_removed")
        {
            var maxUserId = TryGetUserId(update);
            if (maxUserId > 0)
                await DeactivateByMaxUserIdAsync(maxUserId, cancellationToken);
            return;
        }

        if (updateType == "bot_started")
        {
            var maxUserId = TryGetUserId(update);
            if (maxUserId > 0)
            {
                await _api.SendMessageToUserAsync(
                    maxUserId,
                    BuildWelcomeText(),
                    cancellationToken);
            }
            return;
        }

        if (updateType != "message_created")
            return;

        if (!update.TryGetProperty("message", out var message))
            return;

        var senderId = TryGetSenderId(message);
        if (senderId <= 0)
            return;

        var text = TryGetMessageText(message)?.Trim() ?? "";
        if (string.IsNullOrEmpty(text))
            return;

        await HandleCommandAsync(senderId, text, cancellationToken);
    }

    private async Task HandleCommandAsync(long maxUserId, string text, CancellationToken cancellationToken)
    {
        var lower = text.ToLowerInvariant();
        if (lower is "/start" or "/help" or "help" or "помощь")
        {
            await _api.SendMessageToUserAsync(maxUserId, BuildWelcomeText(), cancellationToken);
            return;
        }

        if (lower.StartsWith("/link ", StringComparison.Ordinal))
        {
            var code = text["/link ".Length..].Trim().ToUpperInvariant();
            await LinkByCodeAsync(maxUserId, code, cancellationToken);
            return;
        }

        if (lower.StartsWith("/subscribe ", StringComparison.Ordinal) || lower.StartsWith("/sub ", StringComparison.Ordinal))
        {
            var idPart = lower.StartsWith("/sub ", StringComparison.Ordinal)
                ? text["/sub ".Length..].Trim()
                : text["/subscribe ".Length..].Trim();
            if (int.TryParse(idPart, out var taskId))
                await SubscribeByMaxUserAsync(maxUserId, taskId, cancellationToken);
            else
                await _api.SendMessageToUserAsync(maxUserId, "Укажите номер задачи: `/subscribe 123`", cancellationToken);
            return;
        }

        if (lower.StartsWith("/unsubscribe ", StringComparison.Ordinal) || lower.StartsWith("/unsub ", StringComparison.Ordinal))
        {
            var idPart = lower.StartsWith("/unsub ", StringComparison.Ordinal)
                ? text["/unsub ".Length..].Trim()
                : text["/unsubscribe ".Length..].Trim();
            if (int.TryParse(idPart, out var taskId))
                await UnsubscribeByMaxUserAsync(maxUserId, taskId, cancellationToken);
            else
                await _api.SendMessageToUserAsync(maxUserId, "Укажите номер задачи: `/unsubscribe 123`", cancellationToken);
            return;
        }

        if (lower is "/list" or "/subscriptions")
        {
            await ListSubscriptionsAsync(maxUserId, cancellationToken);
            return;
        }
    }

    private async Task LinkByCodeAsync(long maxUserId, string code, CancellationToken cancellationToken)
    {
        var now = _time.Now;
        var token = await _db.MaxLinkTokens.FirstOrDefaultAsync(t => t.Code == code, cancellationToken);
        if (token == null || token.ExpiresAt < now)
        {
            await _api.SendMessageToUserAsync(maxUserId, "Код не найден или истёк. Получите новый код в веб-приложении.", cancellationToken);
            return;
        }

        var existingForMax = await _db.UserMaxLinks
            .FirstOrDefaultAsync(l => l.MaxUserId == maxUserId && l.IsActive, cancellationToken);
        if (existingForMax != null && existingForMax.UserId != token.UserId)
        {
            existingForMax.IsActive = false;
        }

        var link = await _db.UserMaxLinks.FirstOrDefaultAsync(l => l.UserId == token.UserId, cancellationToken);
        if (link == null)
        {
            link = new UserMaxLink { UserId = token.UserId };
            _db.UserMaxLinks.Add(link);
        }

        link.MaxUserId = maxUserId;
        link.IsActive = true;
        link.LinkedAt = now;

        _db.MaxLinkTokens.Remove(token);
        await _db.SaveChangesAsync(cancellationToken);

        await _api.SendMessageToUserAsync(
            maxUserId,
            "Аккаунт привязан. Подпишитесь на задачи в таблице (колокольчик) или командой `/subscribe ID`.",
            cancellationToken);
    }

    private async Task SubscribeByMaxUserAsync(long maxUserId, int taskId, CancellationToken cancellationToken)
    {
        var userId = await GetUserIdByMaxUserIdAsync(maxUserId, cancellationToken);
        if (userId == null)
        {
            await _api.SendMessageToUserAsync(maxUserId, "Сначала привяжите аккаунт: `/link КОД` из веб-приложения.", cancellationToken);
            return;
        }

        try
        {
            await SubscribeAsync(userId, taskId, cancellationToken);
            await _api.SendMessageToUserAsync(maxUserId, $"Подписка на задачу #{taskId} включена.", cancellationToken);
        }
        catch (Exception ex)
        {
            await _api.SendMessageToUserAsync(maxUserId, ex.Message, cancellationToken);
        }
    }

    private async Task UnsubscribeByMaxUserAsync(long maxUserId, int taskId, CancellationToken cancellationToken)
    {
        var userId = await GetUserIdByMaxUserIdAsync(maxUserId, cancellationToken);
        if (userId == null)
        {
            await _api.SendMessageToUserAsync(maxUserId, "Аккаунт не привязан.", cancellationToken);
            return;
        }

        await UnsubscribeAsync(userId, taskId, cancellationToken);
        await _api.SendMessageToUserAsync(maxUserId, $"Подписка на задачу #{taskId} отключена.", cancellationToken);
    }

    private async Task ListSubscriptionsAsync(long maxUserId, CancellationToken cancellationToken)
    {
        var userId = await GetUserIdByMaxUserIdAsync(maxUserId, cancellationToken);
        if (userId == null)
        {
            await _api.SendMessageToUserAsync(maxUserId, "Аккаунт не привязан.", cancellationToken);
            return;
        }

        var ids = await GetSubscribedTaskIdsAsync(userId, cancellationToken);
        var text = ids.Length == 0
            ? "Нет активных подписок."
            : "Подписки на задачи:\n" + string.Join(", ", ids.Select(id => $"#{id}"));
        await _api.SendMessageToUserAsync(maxUserId, text, cancellationToken);
    }

    private async Task DeactivateByMaxUserIdAsync(long maxUserId, CancellationToken cancellationToken)
    {
        var links = await _db.UserMaxLinks.Where(l => l.MaxUserId == maxUserId && l.IsActive).ToListAsync(cancellationToken);
        if (links.Count == 0)
            return;

        foreach (var link in links)
            link.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<string?> GetUserIdByMaxUserIdAsync(long maxUserId, CancellationToken cancellationToken)
    {
        return await _db.UserMaxLinks
            .AsNoTracking()
            .Where(l => l.MaxUserId == maxUserId && l.IsActive)
            .Select(l => l.UserId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private string BuildWelcomeText()
    {
        var botHint = string.IsNullOrWhiteSpace(_options.BotUsername)
            ? "бота"
            : $"@{_options.BotUsername.Trim().TrimStart('@')}";

        return $"""
            Привет! Я бот **Production Planner**.

            1. В веб-приложении откройте меню пользователя → **Привязать MAX**.
            2. Отправьте сюда команду `/link КОД`.
            3. Подпишитесь на задачу в таблице (колокольчик) или командой `/subscribe ID`.

            Команды: `/list`, `/unsubscribe ID`, `/help`
            """;
    }

    private static string GenerateLinkCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Span<char> chars = stackalloc char[8];
        for (var i = 0; i < chars.Length; i++)
            chars[i] = alphabet[Random.Shared.Next(alphabet.Length)];
        return new string(chars);
    }

    private static string FormatStatusLabel(string newStatus)
    {
        if (string.IsNullOrWhiteSpace(newStatus))
            return "";

        if (Enum.TryParse<JobStatus>(newStatus, ignoreCase: true, out var parsed))
            return TaskStatusMapper.ToText(parsed);

        return TaskStatusMapper.ToText(TaskStatusMapper.FromText(newStatus));
    }

    private static bool IsCompletedStatus(string status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return false;

        if (Enum.TryParse<JobStatus>(status, ignoreCase: true, out var parsed))
            return parsed == JobStatus.Completed;

        return TaskStatusMapper.FromText(status) == JobStatus.Completed;
    }

    private static string EscapeMarkdown(string value) =>
        (value ?? "").Replace("*", "\\*", StringComparison.Ordinal);

    private static long TryGetUserId(System.Text.Json.JsonElement update)
    {
        if (update.TryGetProperty("user", out var user) && user.TryGetProperty("user_id", out var id))
            return id.GetInt64();
        if (update.TryGetProperty("user_id", out var flatId))
            return flatId.GetInt64();
        return 0;
    }

    private static long TryGetSenderId(System.Text.Json.JsonElement message)
    {
        if (message.TryGetProperty("sender", out var sender) && sender.TryGetProperty("user_id", out var id))
            return id.GetInt64();
        return 0;
    }

    private static string? TryGetMessageText(System.Text.Json.JsonElement message)
    {
        if (!message.TryGetProperty("body", out var body) || body.ValueKind == System.Text.Json.JsonValueKind.Null)
            return null;
        if (body.TryGetProperty("text", out var textEl))
            return textEl.GetString();
        return null;
    }
}
