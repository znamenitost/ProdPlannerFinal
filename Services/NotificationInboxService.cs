using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public class NotificationInboxService : INotificationInboxService
{
    private readonly ApplicationDbContext _context;
    private readonly IAppTimeService _timeService;

    public NotificationInboxService(ApplicationDbContext context, IAppTimeService timeService)
    {
        _context = context;
        _timeService = timeService;
    }

    public Task<long> EnqueueNewTaskAsync(string userId, int taskId, string title, DateTime deadline) =>
        EnqueueAsync(userId, "NewTask", taskId, title, deadline);

    public Task<long> EnqueueTaskReadyToStartAsync(string userId, int taskId, string title, DateTime deadline) =>
        EnqueueAsync(userId, "TaskReadyToStart", taskId, title, deadline);

    private async Task<long> EnqueueAsync(string userId, string type, int taskId, string title, DateTime deadline)
    {
        var notification = new UserNotification
        {
            UserId = userId,
            Type = type,
            TaskId = taskId,
            Title = title,
            Deadline = deadline,
            CreatedAt = _timeService.Now
        };

        _context.UserNotifications.Add(notification);
        await _context.SaveChangesAsync();
        return notification.Id;
    }

    public async Task<IReadOnlyList<NotificationDto>> GetPendingAsync(string userId)
    {
        return await _context.UserNotifications
            .AsNoTracking()
            .Where(n => n.UserId == userId && n.AcknowledgedAt == null)
            .OrderBy(n => n.CreatedAt)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Type = n.Type,
                TaskId = n.TaskId,
                Title = n.Title,
                Deadline = n.Deadline,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<bool> AcknowledgeAsync(string userId, long notificationId)
    {
        var notification = await _context.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);

        if (notification == null)
            return false;

        if (notification.AcknowledgedAt == null)
        {
            notification.AcknowledgedAt = _timeService.Now;
            await _context.SaveChangesAsync();
        }

        return true;
    }
}
