using ProductionPlanner.Models;

namespace ProductionPlanner.Data
{
    public interface IProductionTaskRepository
    {
        Task<List<ProductionTask>> GetActiveTasksAsync(string employeeName);
        Task<List<ProductionTask>> GetCompletedTasksAsync(string employeeName);
        Task<ProductionTask?> GetTaskByIdAsync(int id);
        Task<ProductionTask?> GetTaskByRowNumberAsync(int rowNumber);
        Task AddTaskAsync(ProductionTask task);
        Task UpdateTaskAsync(ProductionTask task);
        Task DeleteTaskAsync(int id);
        Task DeleteAllTasksAsync();
        Task AddWorkIntervalAsync(WorkInterval interval);
        Task UpdateWorkIntervalAsync(WorkInterval interval);
        Task DeleteWorkIntervalAsync(WorkInterval interval);
        Task DeleteAllWorkIntervalsAsync();
        Task<EmployeeStat?> GetEmployeeStatAsync(string employeeName);
        Task UpdateEmployeeStatAsync(EmployeeStat stat);
        Task<List<ProductionTask>> GetAllTasksAsync();
        Task<List<ProductionTask>> GetRootTasksAsync();
        Task<List<ProductionTask>> GetChildTasksAsync(int parentId);
        Task ReorderTasksAsync(List<int> orderedIds);
    }
}