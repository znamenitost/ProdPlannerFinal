using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

public interface INotificationInboxService
{
    Task<long> EnqueueNewTaskAsync(string userId, int taskId, string title, DateTime? deadline);
    Task<long> EnqueueTaskReadyToStartAsync(string userId, int taskId, string title, DateTime? deadline, JobStatus readyStatus);
    Task<long> EnqueueSequentialStageReadyAsync(string userId, int taskId, string title, DateTime? deadline);
    Task<long> EnqueueTaskCommentAddedAsync(string userId, int taskId, string title, DateTime? deadline);
    Task<IReadOnlyList<NotificationDto>> GetPendingAsync(string userId);
    Task<bool> AcknowledgeAsync(string userId, long notificationId);
}
