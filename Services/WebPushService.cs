using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using WebPush;

namespace ProductionPlanner.Services;

public sealed class WebPushService : IWebPushService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ApplicationDbContext _db;
    private readonly IAppTimeService _time;
    private readonly WebPushOptions _options;
    private readonly ILogger<WebPushService> _logger;

    public WebPushService(
        ApplicationDbContext db,
        IAppTimeService time,
        IOptions<WebPushOptions> options,
        ILogger<WebPushService> logger)
    {
        _db = db;
        _time = time;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SaveSubscriptionAsync(
        string userId,
        string endpoint,
        string p256dh,
        string auth,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(endpoint)
            || string.IsNullOrWhiteSpace(p256dh)
            || string.IsNullOrWhiteSpace(auth))
            return;

        var existing = await _db.WebPushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint, ct);

        var now = _time.Now;
        if (existing == null)
        {
            _db.WebPushSubscriptions.Add(new WebPushSubscription
            {
                UserId = userId,
                Endpoint = endpoint.Trim(),
                P256dh = p256dh.Trim(),
                Auth = auth.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            existing.UserId = userId;
            existing.P256dh = p256dh.Trim();
            existing.Auth = auth.Trim();
            existing.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveSubscriptionAsync(string userId, string endpoint, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(endpoint))
            return;

        var existing = await _db.WebPushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == endpoint, ct);
        if (existing == null)
            return;

        _db.WebPushSubscriptions.Remove(existing);
        await _db.SaveChangesAsync(ct);
    }

    public async Task SendChatMessageAsync(
        IEnumerable<string> userIds,
        string title,
        string body,
        long conversationId,
        CancellationToken ct = default)
    {
        if (!_options.IsConfigured)
            return;

        var recipients = userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (recipients.Count == 0)
            return;

        var subscriptions = await _db.WebPushSubscriptions
            .AsNoTracking()
            .Where(s => recipients.Contains(s.UserId))
            .ToListAsync(ct);
        if (subscriptions.Count == 0)
            return;

        var payload = JsonSerializer.Serialize(new
        {
            title = string.IsNullOrWhiteSpace(title) ? "Сообщение" : title.Trim(),
            body = string.IsNullOrWhiteSpace(body) ? "Новое сообщение" : body.Trim(),
            url = $"/?chat={conversationId}"
        }, JsonOptions);

        var client = new WebPushClient();
        var vapid = new VapidDetails(_options.Subject, _options.PublicKey, _options.PrivateKey);
        var stale = new List<WebPushSubscription>();

        foreach (var sub in subscriptions)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await client.SendNotificationAsync(pushSub, payload, vapid);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone
                || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                stale.Add(sub);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Web push failed for endpoint {Endpoint}", sub.Endpoint);
            }
        }

        if (stale.Count == 0)
            return;

        var endpoints = stale.Select(s => s.Endpoint).ToList();
        var toRemove = await _db.WebPushSubscriptions
            .Where(s => endpoints.Contains(s.Endpoint))
            .ToListAsync(ct);
        if (toRemove.Count > 0)
        {
            _db.WebPushSubscriptions.RemoveRange(toRemove);
            await _db.SaveChangesAsync(ct);
        }
    }
}
