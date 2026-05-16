using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public interface ITaskSplitService
    {
        Task<ProductionTask> SplitTaskAsync(int parentTaskId, List<SplitPart> parts);
        Task<ProductionTask> UpdateSplitAsync(int parentTaskId, List<SplitPart> parts);
        Task<bool> AreAllSubtasksCompletedAsync(int parentRowNumber);
        Task UpdateParentCompletionStatusAsync(int parentRowNumber);
        Task<List<ProductionTask>> GetChildTasksAsync(int parentRowNumber);
    }
}