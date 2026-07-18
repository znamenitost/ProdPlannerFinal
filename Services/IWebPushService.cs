namespace ProductionPlanner.Services;

public interface IWebPushService
{
    Task SaveSubscriptionAsync(string userId, string endpoint, string p256dh, string auth, CancellationToken ct = default);
    Task RemoveSubscriptionAsync(string userId, string endpoint, CancellationToken ct = default);

    Task SendAsync(
        IEnumerable<string> userIds,
        string title,
        string body,
        string url,
        string? tag = null,
        CancellationToken ct = default);

    Task SendChatMessageAsync(
        IEnumerable<string> userIds,
        string title,
        string body,
        long conversationId,
        CancellationToken ct = default);
}
