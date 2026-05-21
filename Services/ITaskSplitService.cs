using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public interface ITaskSplitService
    {
        Task<ProductionTask> SplitTaskAsync(int parentTaskId, List<SplitPart> parts, CancellationToken cancellationToken = default);
        Task<ProductionTask> UpdateSplitAsync(int parentTaskId, List<SplitPart> parts, CancellationToken cancellationToken = default);
        Task<bool> AreAllSubtasksCompletedAsync(int parentRowNumber, CancellationToken cancellationToken = default);
        Task UpdateParentCompletionStatusAsync(int parentRowNumber, CancellationToken cancellationToken = default);
        Task<List<ProductionTask>> GetChildTasksAsync(int parentRowNumber, CancellationToken cancellationToken = default);
    }
}
