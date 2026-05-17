using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.TaskTable;

public interface ITaskTableService
{
    Task<PaginatedResult<TaskTableRowDto>> GetRowsAsync(int page, int pageSize, string targetEmployeeName);
    Task<TaskTableServiceResult<ProductionTask>> CreateRowAsync(CreateTaskRequest request);
    Task<TaskTableServiceResult<ProductionTask>> UpdateRowAsync(int id, UpdateTaskRequest request);
    Task<TaskTableServiceResult<bool>> DeleteRowAsync(int id);
    Task ReorderRowsAsync(List<int> orderedIds);
}
