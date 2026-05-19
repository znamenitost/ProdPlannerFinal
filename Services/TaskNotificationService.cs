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
    private readonly INotificationInboxService _inbox;
    private readonly ILogger<TaskNotificationService> _logger;

    public TaskNotificationService(
        IHubContext<NotificationHub> hubContext,
        UserManager<User> userManager,
        INotificationInboxService inbox,
        ILogger<TaskNotificationService> logger)
    {
        _hubContext = hubContext;
        _userManager = userManager;
        _inbox = inbox;
        _logger = logger;
    }

    public async Task NotifyNewTaskAsync(ProductionTask task)
    {
        var title = GetNotificationTitle(task);
        var userId = await GetUserIdByFullNameAsync(task.EmployeeName);
        if (!string.IsNullOrEmpty(userId))
        {
            var notificationId = await _inbox.EnqueueNewTaskAsync(
                userId,
                task.Id,
                title,
                task.Deadline);

            await SendToGroupsAsync(
                [userId],
                "NewTask",
                notificationId,
                task.Id,
                title,
                task.Deadline);
        }
        else
        {
            _logger.LogDebug("User not found for new task notification: {EmployeeName}", task.EmployeeName);
        }

        await SendToGroupsAsync(
            [NotificationGroups.Admins],
            "TaskUpdated",
            task.Id,
            title,
            task.Deadline);
    }

    public async Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null)
    {
        var employeeNames = new HashSet<string>(StringComparer.Ordinal);
        if (!string.IsNullOrEmpty(task.EmployeeName))
            employeeNames.Add(task.EmployeeName);
        if (!string.IsNullOrEmpty(oldEmployeeName) && oldEmployeeName != task.EmployeeName)
            employeeNames.Add(oldEmployeeName);

        var groups = await ResolveEmployeeGroupsAsync(employeeNames);
        await SendToGroupsAsync(groups, "TaskUpdated", task.Id, GetNotificationTitle(task), task.Deadline);
    }

    public async Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames)
    {
        var groups = await ResolveEmployeeGroupsAsync(
            employeeNames.Where(name => !string.IsNullOrWhiteSpace(name)));
        await SendToGroupsAsync(groups, "TaskDeleted", taskId);
    }

    public async Task NotifyStatusChangedAsync(ProductionTask task, string newStatus)
    {
        var groups = await ResolveEmployeeGroupsAsync(
            string.IsNullOrEmpty(task.EmployeeName) ? [] : [task.EmployeeName]);
        await SendToGroupsAsync(groups, "TaskStatusChanged", task.Id, newStatus);
    }

    public async Task NotifyProgressChangedAsync(ProductionTask task, double progress)
    {
        var groups = await ResolveEmployeeGroupsAsync(
            string.IsNullOrEmpty(task.EmployeeName) ? [] : [task.EmployeeName]);
        await SendToGroupsAsync(groups, "TaskProgressChanged", task.Id, progress);
    }

    private async Task<List<string>> ResolveEmployeeGroupsAsync(IEnumerable<string> employeeNames)
    {
        var groups = new HashSet<string>(StringComparer.Ordinal) { NotificationGroups.Admins };
        foreach (var employeeName in employeeNames.Distinct(StringComparer.Ordinal))
        {
            var userId = await GetUserIdByFullNameAsync(employeeName);
            if (!string.IsNullOrEmpty(userId))
                groups.Add(userId);
        }
        return groups.ToList();
    }

    private Task SendToGroupsAsync(IReadOnlyList<string> groups, string method, params object?[] args)
    {
        if (groups.Count == 0)
            return Task.CompletedTask;
        return _hubContext.Clients.Groups(groups).SendCoreAsync(method, args);
    }

    public static string GetNotificationTitle(ProductionTask task)
    {
        var name = task.TaskDisplayName;
        if (!string.IsNullOrWhiteSpace(name))
            return name.Trim();
        if (!string.IsNullOrWhiteSpace(task.FileName))
            return task.FileName.Trim();
        if (!string.IsNullOrWhiteSpace(task.Comment))
        {
            var comment = task.Comment.Trim();
            return comment.Length > 80 ? comment[..80] + "…" : comment;
        }
        return $"Задача #{task.Id}";
    }

    private async Task<string?> GetUserIdByFullNameAsync(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return null;

        var user = await _userManager.Users.FirstOrDefaultAsync(u => u.FullName == fullName);
        return user?.Id;
    }
}
