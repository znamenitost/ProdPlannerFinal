using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.TaskTable;

public interface ITaskTableService
{
    Task<PaginatedResult<TaskTableRowDto>> GetRowsAsync(
        int page,
        int pageSize,
        string targetEmployeeName,
        bool excludeCompleted = false,
        string? search = null,
        bool viewerIsAdmin = true,
        string? viewerUserId = null,
        CancellationToken cancellationToken = default);
    Task<TaskTableRowDto?> GetRowDtoAsync(
        int id,
        string targetEmployeeName,
        bool viewerIsAdmin = true,
        string? viewerUserId = null,
        CancellationToken cancellationToken = default);
        Task<TaskTableServiceResult<ProductionTask>> CreateRowAsync(
        CreateTaskRequest request,
        CancellationToken cancellationToken = default);
    Task<TaskTableServiceResult<ProductionTask>> CreateFussRowAsync(
        string employeeName,
        string comment,
        CancellationToken cancellationToken = default);
    Task<TaskTableServiceResult<ProductionTask>> UpdateRowAsync(
        int id,
        UpdateTaskRequest request,
        CancellationToken cancellationToken = default);
    Task<TaskTableServiceResult<List<WorkIntervalEditDto>>> GetIntervalsAsync(
        int taskId,
        CancellationToken cancellationToken = default);
    Task<TaskTableServiceResult<List<WorkIntervalEditDto>>> UpdateIntervalsAsync(
        int taskId,
        UpdateWorkIntervalsRequest request,
        CancellationToken cancellationToken = default);
    Task<TaskTableServiceResult<bool>> DeleteRowAsync(int id, CancellationToken cancellationToken = default);
    Task ReorderRowsAsync(List<int> orderedIds, CancellationToken cancellationToken = default);
}
