using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public interface INotificationInboxService
{
    Task<long> EnqueueNewTaskAsync(string userId, int taskId, string title, DateTime deadline);
    Task<IReadOnlyList<NotificationDto>> GetPendingAsync(string userId);
    Task<bool> AcknowledgeAsync(string userId, long notificationId);
}
