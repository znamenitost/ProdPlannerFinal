using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Hubs;
using ProductionPlanner.Models;
using ProductionPlanner.Services.MaxMessenger;

namespace ProductionPlanner.Services;

public class TaskNotificationService : ITaskNotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ITaskDataSyncHubBroadcaster _dataSync;
    private readonly UserManager<User> _userManager;
    private readonly INotificationInboxService _inbox;
    private readonly IMaxMessengerService _maxMessenger;
    private readonly ILogger<TaskNotificationService> _logger;

    public TaskNotificationService(
        IHubContext<NotificationHub> hubContext,
        ITaskDataSyncHubBroadcaster dataSync,
        UserManager<User> userManager,
        INotificationInboxService inbox,
        IMaxMessengerService maxMessenger,
        ILogger<TaskNotificationService> logger)
    {
        _hubContext = hubContext;
        _dataSync = dataSync;
        _userManager = userManager;
        _inbox = inbox;
        _maxMessenger = maxMessenger;
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
                task.Deadline,
                "NewTask");
        }
        else
        {
            _logger.LogDebug("User not found for new task notification: {EmployeeName}", task.EmployeeName);
        }

        await _dataSync.BroadcastAsync(
            "TaskUpdated",
            AffectedEmployees(task.EmployeeName),
            task.Id,
            title,
            task.Deadline,
            AffectedEmployees(task.EmployeeName));
    }

    public Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null) =>
        _dataSync.BroadcastAsync(
            "TaskUpdated",
            AffectedEmployees(task.EmployeeName, oldEmployeeName),
            task.Id,
            GetNotificationTitle(task),
            task.Deadline,
            AffectedEmployees(task.EmployeeName, oldEmployeeName));

    public Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames) =>
        _dataSync.BroadcastAsync(
            "TaskDeleted",
            AffectedEmployees(employeeNames),
            taskId,
            AffectedEmployees(employeeNames));

    public async Task NotifyStatusChangedAsync(ProductionTask task, string newStatus)
    {
        await _dataSync.BroadcastAsync(
            "TaskStatusChanged",
            AffectedEmployees(task.EmployeeName),
            task.Id,
            newStatus,
            AffectedEmployees(task.EmployeeName));

        try
        {
            await _maxMessenger.NotifyTaskStatusChangedAsync(task, newStatus);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MAX: не удалось отправить уведомление о статусе задачи {TaskId}", task.Id);
        }
    }

    public Task NotifyProgressChangedAsync(ProductionTask task, double progress)
    {
        var affected = AffectedEmployees(task.EmployeeName);
        _dataSync.ScheduleProgressChanged(task, progress, affected);
        return Task.CompletedTask;
    }

    public async Task NotifyTaskReadyToStartAsync(ProductionTask task, JobStatus readyStatus)
    {
        if (string.IsNullOrWhiteSpace(task.EmployeeName))
            return;

        var userId = await GetUserIdByFullNameAsync(task.EmployeeName);
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogDebug(
                "User not found for ready-to-start notification: {EmployeeName}",
                task.EmployeeName);
            return;
        }

        var title = $"Можно начинать: {GetNotificationTitle(task)}";

        var notificationId = await _inbox.EnqueueTaskReadyToStartAsync(
            userId,
            task.Id,
            title,
            task.Deadline,
            readyStatus);

        await SendToGroupsAsync(
            [userId],
            "NewTask",
            notificationId,
            task.Id,
            title,
            task.Deadline,
            readyStatus == JobStatus.InStock ? "TaskInStockReady" : "TaskApprovedReady");
    }

    public async Task NotifySequentialStageReadyAsync(ProductionTask task, int stageNumber)
    {
        if (string.IsNullOrWhiteSpace(task.EmployeeName))
            return;

        var userId = await GetUserIdByFullNameAsync(task.EmployeeName);
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogDebug(
                "User not found for sequential stage notification: {EmployeeName}",
                task.EmployeeName);
            return;
        }

        var safeStageNumber = Math.Max(1, stageNumber);
        var title = $"Можно начинать этап №{safeStageNumber}: {GetNotificationTitle(task)}";

        var notificationId = await _inbox.EnqueueSequentialStageReadyAsync(
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
            task.Deadline,
            "SequentialStageReady");
    }

    private Task SendToGroupsAsync(IReadOnlyList<string> groups, string method, params object?[] args)
    {
        if (groups.Count == 0)
            return Task.CompletedTask;
        return _hubContext.Clients.Groups(groups).SendCoreAsync(method, args);
    }

    private static string[] AffectedEmployees(params string?[] employeeNames) =>
        employeeNames
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

    private static string[] AffectedEmployees(IEnumerable<string> employeeNames) =>
        employeeNames
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

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
