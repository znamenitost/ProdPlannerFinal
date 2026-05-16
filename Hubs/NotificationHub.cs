using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ProductionPlanner.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            Console.WriteLine($"Client connected: {Context.ConnectionId}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            Console.WriteLine($"Client disconnected: {Context.ConnectionId}");
            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinUserGroup(string userId)
        {
            var currentUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId != userId)
                throw new HubException("Cannot join another user's notification group.");

            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            Console.WriteLine($"Connection {Context.ConnectionId} joined group {userId}");
        }

        public async Task LeaveUserGroup(string userId)
        {
            var currentUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId != userId)
                throw new HubException("Cannot leave another user's notification group.");

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            Console.WriteLine($"Connection {Context.ConnectionId} left group {userId}");
        }
    }
}