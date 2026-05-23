using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public interface ITaskLifecycleService
    {
        Task StartTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default);
        Task PauseTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default);
        Task ResumeTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default);
        Task UpdateProgressAsync(int taskId, double newProgress, DateTime now, CancellationToken cancellationToken = default);
        Task CompleteTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default);
        Task ReturnTaskAsync(int taskId, DateTime now, CancellationToken cancellationToken = default);
        /// <summary>Обновить статус родителя сплит-задачи после изменения дочерней.</summary>
        Task SyncSplitParentStatusAsync(int childTaskId, CancellationToken cancellationToken = default);
    }
}
