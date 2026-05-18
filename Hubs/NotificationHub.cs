using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ProductionPlanner.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userId))
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);

            await base.OnConnectedAsync();
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
}
