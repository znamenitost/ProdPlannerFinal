using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using ProductionPlanner.Models;
using System.Security.Claims;

namespace ProductionPlanner.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public const string ForceDisconnectMethod = "ForceDisconnect";

    private readonly UserManager<User> _userManager;
    private readonly NotificationConnectionRegistry _connections;
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(
        UserManager<User> userManager,
        NotificationConnectionRegistry connections,
        ILogger<NotificationHub> logger)
    {
        _userManager = userManager;
        _connections = connections;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            var stale = _connections.Register(userId, Context.ConnectionId);
            foreach (var staleId in stale)
            {
                await Groups.RemoveFromGroupAsync(staleId, userId);
                await Clients.Client(staleId).SendAsync(ForceDisconnectMethod);
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        }

        var user = await _userManager.GetUserAsync(Context.User!);
        if (user != null && await _userManager.IsInRoleAsync(user, "Admin"))
            await Groups.AddToGroupAsync(Context.ConnectionId, NotificationGroups.Admins);

        _logger.LogDebug(
            "SignalR connected {ConnectionId} user {UserId} (active: {Count})",
            Context.ConnectionId,
            userId ?? "?",
            string.IsNullOrEmpty(userId) ? 0 : _connections.CountForUser(userId));

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            _connections.Unregister(userId, Context.ConnectionId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, NotificationGroups.Admins);

        if (exception != null)
            _logger.LogDebug(exception, "SignalR disconnected {ConnectionId}", Context.ConnectionId);
        else
            _logger.LogDebug("SignalR disconnected {ConnectionId}", Context.ConnectionId);

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinUserGroup(string userId)
    {
        var currentUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId != userId)
            throw new HubException("Cannot join another user's notification group.");

        await Groups.AddToGroupAsync(Context.ConnectionId, userId);
    }

    public async Task LeaveUserGroup(string userId)
    {
        var currentUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId != userId)
            throw new HubException("Cannot leave another user's notification group.");

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
    }
}
