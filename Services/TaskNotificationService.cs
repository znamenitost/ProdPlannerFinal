using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Hubs;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

public class TaskNotificationService : ITaskNotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly UserManager<User> _userManager;
    private readonly ILogger<TaskNotificationService> _logger;

    public TaskNotificationService(
        IHubContext<NotificationHub> hubContext,
        UserManager<User> userManager,
        ILogger<TaskNotificationService> logger)
    {
        _hubContext = hubContext;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task NotifyNewTaskAsync(ProductionTask task)
    {
        var userId = await GetUserIdByFullNameAsync(task.EmployeeName);
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogDebug("User not found for new task notification: {EmployeeName}", task.EmployeeName);
            return;
        }

        await _hubContext.Clients.Group(userId).SendAsync("NewTask", task.Id, task.TaskDisplayName, task.Deadline);
    }

    public async Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null)
    {
        var usersToNotify = new HashSet<string>();
        if (!string.IsNullOrEmpty(task.EmployeeName))
            usersToNotify.Add(task.EmployeeName);
        if (!string.IsNullOrEmpty(oldEmployeeName) && oldEmployeeName != task.EmployeeName)
            usersToNotify.Add(oldEmployeeName);

        foreach (var employeeName in usersToNotify)
        {
            var userId = await GetUserIdByFullNameAsync(employeeName);
            if (!string.IsNullOrEmpty(userId))
                await _hubContext.Clients.Group(userId).SendAsync("TaskUpdated", task.Id, task.TaskDisplayName, task.Deadline);
        }
    }

    public async Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames)
    {
        foreach (var employeeName in employeeNames.Where(name => !string.IsNullOrWhiteSpace(name)).Distinct())
        {
            var userId = await GetUserIdByFullNameAsync(employeeName);
            if (!string.IsNullOrEmpty(userId))
                await _hubContext.Clients.Group(userId).SendAsync("TaskDeleted", taskId);
        }
    }

    public async Task NotifyStatusChangedAsync(ProductionTask task, string newStatus)
    {
        var userId = await GetUserIdByFullNameAsync(task.EmployeeName);
        if (!string.IsNullOrEmpty(userId))
            await _hubContext.Clients.Group(userId).SendAsync("TaskStatusChanged", task.Id, newStatus);
    }

    public async Task NotifyProgressChangedAsync(ProductionTask task, double progress)
    {
        var userId = await GetUserIdByFullNameAsync(task.EmployeeName);
        if (!string.IsNullOrEmpty(userId))
            await _hubContext.Clients.Group(userId).SendAsync("TaskProgressChanged", task.Id, progress);
    }

    private async Task<string?> GetUserIdByFullNameAsync(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return null;

        var user = await _userManager.Users.FirstOrDefaultAsync(u => u.FullName == fullName);
        return user?.Id;
    }
}
