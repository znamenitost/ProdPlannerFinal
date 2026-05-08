using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public interface ITaskLifecycleService
    {
        Task StartTaskAsync(int taskId, DateTime now);
        Task PauseTaskAsync(int taskId, DateTime now);
        Task ResumeTaskAsync(int taskId, DateTime now);
        Task UpdateProgressAsync(int taskId, double newProgress, DateTime now);
        Task CompleteTaskAsync(int taskId, DateTime now);
        Task ReturnTaskAsync(int taskId, DateTime now);
    }
}