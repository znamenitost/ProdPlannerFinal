using ProductionPlanner.Models;

namespace ProductionPlanner.Services;

public interface ITaskNotificationService
{
    Task NotifyNewTaskAsync(ProductionTask task);
    Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null);
    Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames);
    Task NotifyStatusChangedAsync(ProductionTask task, string newStatus);
    Task NotifyProgressChangedAsync(ProductionTask task, double progress);
    Task NotifyTaskReadyToStartAsync(ProductionTask task, JobStatus readyStatus);
    Task NotifySequentialStageReadyAsync(ProductionTask task, int stageNumber);
}
