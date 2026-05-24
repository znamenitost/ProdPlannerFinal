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

            // Персональный push-снэкбар «Новая задача» — только исполнителю,
            // его не должны видеть другие пользователи.
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

        // Data-sync для таблицы/календаря у всех подключённых клиентов:
        // таблица показывает все корневые задачи, и любой сотрудник, открывший её,
        // должен увидеть новую строку без ручного refresh.
        await BroadcastAsync("TaskUpdated", task.Id, title, task.Deadline);
    }

    public Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null) =>
        BroadcastAsync("TaskUpdated", task.Id, GetNotificationTitle(task), task.Deadline);

    public Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames) =>
        BroadcastAsync("TaskDeleted", taskId);

    public Task NotifyStatusChangedAsync(ProductionTask task, string newStatus) =>
        BroadcastAsync("TaskStatusChanged", task.Id, newStatus);

    public Task NotifyProgressChangedAsync(ProductionTask task, double progress) =>
        BroadcastAsync("TaskProgressChanged", task.Id, progress);

    private Task SendToGroupsAsync(IReadOnlyList<string> groups, string method, params object?[] args)
    {
        if (groups.Count == 0)
            return Task.CompletedTask;
        return _hubContext.Clients.Groups(groups).SendCoreAsync(method, args);
    }

    /// <summary>
    /// Broadcast события синхронизации данных всем подключённым клиентам хаба
    /// (хаб под <c>[Authorize]</c>, так что это все авторизованные пользователи).
    /// Используется для TaskUpdated/TaskDeleted/TaskStatusChanged/TaskProgressChanged,
    /// чтобы таблица и календарь обновлялись у каждого, кто их сейчас открыл,
    /// а не только у админа и исполнителя задачи.
    /// </summary>
    private Task BroadcastAsync(string method, params object?[] args) =>
        _hubContext.Clients.All.SendCoreAsync(method, args);

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
